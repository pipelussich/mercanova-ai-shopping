import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { allocate, type Allocation, type DeliveryMethod } from "@/domain/allocation";
import { checkoutSchema, type CheckoutInput } from "@/domain/checkout";
import { DomainError } from "@/domain/errors";
import { toCents } from "@/domain/money";
import { stockStatus } from "@/domain/stock";
import { ensureSession } from "../cart/cart-service";

export type Order = {
  id: string;
  createdAt: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  deliveryMethod: DeliveryMethod;
  address: string | null;
  department: string | null;
  pickupWarehouse: { id: string; name: string; city: string } | null;
  items: { productId: string; productName: string; unitPriceCents: number; quantity: number; lineTotalCents: number }[];
  allocations: { productId: string; warehouseId: string; warehouseName: string; quantity: number }[];
  totalCents: number;
};

export type PlaceOrderInput = CheckoutInput & { idempotencyKey: string; expectedTotalCents: number };

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const UNIQUE_VIOLATION = "23505";

/**
 * Registra una compra simulada (RF-12..RF-15) en una sola transacción:
 * idempotencia → bloqueo del inventario involucrado → revalidación de stock y precio →
 * asignación a depósitos → descuento de stock → orden con snapshot de precios → carrito vacío.
 * Sólo la llama `POST /api/orders` tras la confirmación explícita del usuario; el asistente no tiene acceso.
 */
export async function placeOrder(db: DB, sessionId: string, raw: PlaceOrderInput): Promise<Order> {
  const input = checkoutSchema.parse(raw);
  const { idempotencyKey, expectedTotalCents } = raw;

  try {
    const orderId = await db.transaction((tx) =>
      placeOrderTx(tx, sessionId, input, idempotencyKey, expectedTotalCents),
    );
    return (await getOrder(db, sessionId, orderId))!;
  } catch (err) {
    // Dos requests con la misma clave en paralelo (doble click): la segunda espera el lock del carrito y
    // lo encuentra vacío, o choca con el unique. En ambos casos se devuelve la orden que creó la primera.
    const duplicate =
      (err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION ||
      (err instanceof DomainError && err.code === "CART_EMPTY");
    if (duplicate) {
      const existing = await findByIdempotencyKey(db, sessionId, idempotencyKey);
      if (existing) return existing;
    }
    throw err;
  }
}

async function placeOrderTx(
  tx: Tx,
  sessionId: string,
  input: CheckoutInput,
  idempotencyKey: string,
  expectedTotalCents: number,
): Promise<string> {
  const [prior] = await tx.execute<{ id: string }>(sql`
    select id from orders where idempotency_key = ${idempotencyKey} and session_id = ${sessionId}`);
  if (prior) return prior.id;

  const lines = await tx.execute<{
    product_id: string;
    name: string;
    active: boolean;
    quantity: number;
    current_price: string;
  }>(sql`
    select c.product_id, p.name, p.active, c.quantity, pr.current_price
    from cart_items c join products p on p.id = c.product_id join prices pr on pr.product_id = p.id
    where c.session_id = ${sessionId}
    order by c.product_id
    for update of c`);
  if (lines.length === 0) throw new DomainError("CART_EMPTY");

  if (input.deliveryMethod === "pickup") {
    const [w] = await tx.execute<{ pickup_enabled: boolean }>(sql`
      select pickup_enabled from warehouses where id = ${input.pickupWarehouseId!}`);
    if (!w?.pickup_enabled)
      throw new DomainError("INVALID_CHECKOUT", "El depósito elegido no está habilitado para retiro.");
  }

  // Bloqueo en orden determinístico para evitar deadlocks entre compras concurrentes.
  const productIds = lines.map((l) => l.product_id);
  const stockRows = await tx.execute<{ product_id: string; warehouse_id: string; available_qty: number }>(sql`
    select product_id, warehouse_id, available_qty from inventory
    where product_id in ${productIds}
    order by product_id, warehouse_id
    for update`);

  let totalCents = 0;
  const plan: { line: (typeof lines)[number]; unitPriceCents: number; allocations: Allocation[] }[] = [];
  for (const line of lines) {
    if (!line.active)
      throw new DomainError("PRODUCT_INACTIVE", `${line.name} está discontinuado. Quitalo del carrito para continuar.`);
    const stock = stockRows
      .filter((r) => r.product_id === line.product_id)
      .map((r) => ({ warehouseId: r.warehouse_id, available: r.available_qty }));
    let allocations: Allocation[];
    try {
      allocations = allocate(line.quantity, stock, input.deliveryMethod, input.pickupWarehouseId);
    } catch (err) {
      if (err instanceof DomainError)
        throw new DomainError(
          err.code,
          err.code === "PICKUP_UNAVAILABLE"
            ? `El depósito elegido no tiene ${line.quantity} unidades de ${line.name}.`
            : `No hay stock suficiente de ${line.name}: pediste ${line.quantity}.`,
          { productId: line.product_id, ...err.details },
        );
      throw err;
    }
    const unitPriceCents = toCents(line.current_price);
    totalCents += unitPriceCents * line.quantity;
    plan.push({ line, unitPriceCents, allocations });
  }

  if (totalCents !== expectedTotalCents)
    throw new DomainError("PRICE_CHANGED", undefined, { totalCents, expectedTotalCents });

  for (const { line, allocations } of plan)
    for (const a of allocations) {
      const row = stockRows.find((r) => r.product_id === line.product_id && r.warehouse_id === a.warehouseId)!;
      const remaining = row.available_qty - a.quantity;
      await tx.execute(sql`
        update inventory
        set available_qty = available_qty - ${a.quantity},
            on_hand_qty = on_hand_qty - ${a.quantity},
            status = ${stockStatus(remaining)},
            updated_at = now()
        where product_id = ${line.product_id} and warehouse_id = ${a.warehouseId}`);
    }

  const [{ id }] = await tx.execute<{ id: string }>(sql`
    select 'MN-ORD-' || to_char(now() at time zone 'America/Montevideo', 'YYYYMMDD') || '-' ||
           lpad(nextval('order_number_seq')::text, 4, '0') as id`);

  await ensureSession(tx, sessionId);
  await tx.execute(sql`
    insert into orders (id, session_id, idempotency_key, customer_name, email, phone, delivery_method,
                        address, department, pickup_warehouse_id, total_cents)
    values (${id}, ${sessionId}, ${idempotencyKey}, ${input.customerName}, ${input.email}, ${input.phone},
            ${input.deliveryMethod},
            ${input.deliveryMethod === "shipping" ? input.address! : null},
            ${input.deliveryMethod === "shipping" ? input.department! : null},
            ${input.deliveryMethod === "pickup" ? input.pickupWarehouseId! : null},
            ${totalCents})`);
  for (const { line, unitPriceCents, allocations } of plan) {
    await tx.execute(sql`
      insert into order_items (order_id, product_id, product_name, unit_price_cents, quantity)
      values (${id}, ${line.product_id}, ${line.name}, ${unitPriceCents}, ${line.quantity})`);
    for (const a of allocations)
      await tx.execute(sql`
        insert into order_allocations (order_id, product_id, warehouse_id, quantity)
        values (${id}, ${line.product_id}, ${a.warehouseId}, ${a.quantity})`);
  }
  await tx.execute(sql`delete from cart_items where session_id = ${sessionId}`);
  return id;
}

type OrderRow = {
  id: string;
  created_at: Date | string;
  status: string;
  customer_name: string;
  email: string;
  phone: string;
  delivery_method: DeliveryMethod;
  address: string | null;
  department: string | null;
  pickup_warehouse_id: string | null;
  pickup_name: string | null;
  pickup_city: string | null;
  total_cents: number;
};

async function hydrate(db: Pick<DB, "execute">, rows: OrderRow[]): Promise<Order[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [items, allocations] = await Promise.all([
    db.execute<{
      order_id: string;
      product_id: string;
      product_name: string;
      unit_price_cents: number;
      quantity: number;
    }>(
      sql`select order_id, product_id, product_name, unit_price_cents, quantity
          from order_items where order_id in ${ids} order by product_name`,
    ),
    db.execute<{ order_id: string; product_id: string; warehouse_id: string; name: string; quantity: number }>(sql`
      select a.order_id, a.product_id, a.warehouse_id, w.name, a.quantity
      from order_allocations a join warehouses w on w.id = a.warehouse_id
      where a.order_id in ${ids} order by a.product_id, a.warehouse_id`),
  ]);
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status,
    customerName: r.customer_name,
    email: r.email,
    phone: r.phone,
    deliveryMethod: r.delivery_method,
    address: r.address,
    department: r.department,
    pickupWarehouse: r.pickup_warehouse_id
      ? { id: r.pickup_warehouse_id, name: r.pickup_name ?? r.pickup_warehouse_id, city: r.pickup_city ?? "" }
      : null,
    items: items
      .filter((i) => i.order_id === r.id)
      .map((i) => ({
        productId: i.product_id,
        productName: i.product_name,
        unitPriceCents: i.unit_price_cents,
        quantity: i.quantity,
        lineTotalCents: i.unit_price_cents * i.quantity,
      })),
    allocations: allocations
      .filter((a) => a.order_id === r.id)
      .map((a) => ({
        productId: a.product_id,
        warehouseId: a.warehouse_id,
        warehouseName: a.name,
        quantity: a.quantity,
      })),
    totalCents: r.total_cents,
  }));
}

const ORDER_SELECT = sql`
  select o.id, o.created_at, o.status, o.customer_name, o.email, o.phone, o.delivery_method, o.address,
         o.department, o.pickup_warehouse_id, w.name as pickup_name, w.city as pickup_city, o.total_cents
  from orders o left join warehouses w on w.id = o.pickup_warehouse_id`;

export async function getOrder(db: Pick<DB, "execute">, sessionId: string, id: string): Promise<Order | null> {
  const rows = await db.execute<OrderRow>(sql`${ORDER_SELECT} where o.id = ${id} and o.session_id = ${sessionId}`);
  return (await hydrate(db, [...rows]))[0] ?? null;
}

export async function listOrders(db: Pick<DB, "execute">, sessionId: string): Promise<Order[]> {
  const rows = await db.execute<OrderRow>(
    sql`${ORDER_SELECT} where o.session_id = ${sessionId} order by o.created_at desc, o.id desc`,
  );
  return hydrate(db, [...rows]);
}

async function findByIdempotencyKey(db: DB, sessionId: string, key: string): Promise<Order | null> {
  const [row] = await db.execute<{ id: string }>(
    sql`select id from orders where idempotency_key = ${key} and session_id = ${sessionId}`,
  );
  return row ? getOrder(db, sessionId, row.id) : null;
}
