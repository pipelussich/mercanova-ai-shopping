import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { addToCart, getCart } from "@/server/cart/cart-service";
import { getOrder, listOrders, placeOrder } from "@/server/orders/order-service";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { availability, setAvailability } from "./fixtures";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl(), { max: 10 });
const P = "MN-MON-0001"; // US$ 468,62 · 35 u. (CAN 10, COL 7, MAL 4, MVD-CEN 7, MVD-EST 7)

const shipping = {
  customerName: "Ana Pérez",
  email: "ana@example.com",
  phone: "099123456",
  deliveryMethod: "shipping" as const,
  address: "Av. 18 de Julio 1234",
  department: "Montevideo",
};

async function checkout(session: string, overrides: Record<string, unknown> = {}) {
  const cart = await getCart(db, session);
  return placeOrder(db, session, {
    ...shipping,
    idempotencyKey: randomUUID(),
    expectedTotalCents: cart.totalCents,
    ...overrides,
  });
}

async function inv(productId: string) {
  return db.execute<{ warehouse_id: string; available_qty: number; on_hand_qty: number; status: string }>(sql`
    select warehouse_id, available_qty, on_hand_qty, status from inventory where product_id = ${productId} order by warehouse_id`);
}

let session: string;
beforeEach(async () => {
  await resetOperationalState(db, DATASET_PATH);
  session = randomUUID();
});
afterAll(async () => close());

describe("placeOrder", () => {
  it("registra la orden, descuenta stock por depósito y vacía el carrito", async () => {
    await addToCart(db, session, P, 12);
    const before = await inv(P);
    const order = await checkout(session);

    expect(order.id).toMatch(/^MN-ORD-\d{8}-\d{4}$/);
    expect(order.totalCents).toBe(12 * 46862);
    expect(order.items).toEqual([
      expect.objectContaining({ productId: P, quantity: 12, unitPriceCents: 46862, lineTotalCents: 12 * 46862 }),
    ]);
    expect(order.allocations.reduce((s, a) => s + a.quantity, 0)).toBe(12);
    expect((await getCart(db, session)).lines).toHaveLength(0);

    const after = await inv(P);
    for (const row of after) {
      const prev = before.find((b) => b.warehouse_id === row.warehouse_id)!;
      const taken = order.allocations.find((a) => a.warehouseId === row.warehouse_id)?.quantity ?? 0;
      expect(row.available_qty).toBe(prev.available_qty - taken);
      expect(row.on_hand_qty).toBe(prev.on_hand_qty - taken);
    }
    expect(await availability(db, P)).toBe(35 - 12);
  });

  it("recalcula el estado del depósito", async () => {
    // Retiro de 5 en Centro (7 disponibles) → quedan 2 → "Low stock".
    await addToCart(db, session, P, 5);
    await checkout(session, { deliveryMethod: "pickup", pickupWarehouseId: "WH-MVD-CEN" });
    const row = (await inv(P)).find((r) => r.warehouse_id === "WH-MVD-CEN")!;
    expect(row).toMatchObject({ available_qty: 2, status: "Low stock" });
  });

  it("es idempotente ante reintentos con la misma clave", async () => {
    await addToCart(db, session, P, 2);
    const key = randomUUID();
    const total = (await getCart(db, session)).totalCents;
    const input = { ...shipping, idempotencyKey: key, expectedTotalCents: total };
    const first = await placeOrder(db, session, input);
    const second = await placeOrder(db, session, input);
    expect(second.id).toBe(first.id);
    expect(await availability(db, P)).toBe(33);
    const [{ n }] = await db.execute<{ n: string }>(sql`select count(*) as n from orders`);
    expect(Number(n)).toBe(1);
  });

  it("doble click: dos confirmaciones simultáneas con la misma clave devuelven la misma orden", async () => {
    await addToCart(db, session, P, 3);
    const total = (await getCart(db, session)).totalCents;
    const input = { ...shipping, idempotencyKey: randomUUID(), expectedTotalCents: total };
    const [a, b] = await Promise.all([placeOrder(db, session, input), placeOrder(db, session, input)]);
    expect(a.id).toBe(b.id);
    expect(await availability(db, P)).toBe(32);
  });

  it("no vende dos veces la última unidad ante compras concurrentes", async () => {
    await setAvailability(db, P, 1);
    const other = randomUUID();
    await addToCart(db, session, P, 1);
    await addToCart(db, other, P, 1);
    const results = await Promise.allSettled([checkout(session), checkout(other)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await availability(db, P)).toBe(0);
  });

  it("rechaza si el precio cambió desde la revisión y no escribe nada", async () => {
    await addToCart(db, session, P, 1);
    const total = (await getCart(db, session)).totalCents;
    await db.execute(sql`update prices set current_price = 500.00 where product_id = ${P}`);
    try {
      await expect(
        placeOrder(db, session, { ...shipping, idempotencyKey: randomUUID(), expectedTotalCents: total }),
      ).rejects.toMatchObject({ code: "PRICE_CHANGED" });
      expect(await availability(db, P)).toBe(35);
      expect((await getCart(db, session)).lines).toHaveLength(1);
    } finally {
      await db.execute(sql`update prices set current_price = 468.62 where product_id = ${P}`);
    }
  });

  it("rechaza un carrito vacío", async () => {
    await expect(checkout(session)).rejects.toMatchObject({ code: "CART_EMPTY" });
  });

  it("rechaza retiro en un depósito sin stock suficiente sin cambiar nada", async () => {
    await addToCart(db, session, P, 5);
    await expect(checkout(session, { deliveryMethod: "pickup", pickupWarehouseId: "WH-MAL-001" })).rejects.toMatchObject({
      code: "PICKUP_UNAVAILABLE",
    });
    expect(await availability(db, P)).toBe(35);
  });

  it("valida los datos del checkout", async () => {
    await addToCart(db, session, P, 1);
    await expect(checkout(session, { email: "x" })).rejects.toMatchObject({ name: "ZodError" });
  });
});

describe("historial", () => {
  it("sólo devuelve órdenes de la propia sesión, de la más nueva a la más vieja", async () => {
    await addToCart(db, session, P, 1);
    const o1 = await checkout(session);
    await addToCart(db, session, "MN-MON-0002", 1);
    const o2 = await checkout(session);
    expect((await listOrders(db, session)).map((o) => o.id)).toEqual([o2.id, o1.id]);
    expect(await getOrder(db, randomUUID(), o1.id)).toBeNull();
    expect((await getOrder(db, session, o1.id))?.items[0].productName).toBe("Flux Vision 24 QHD IPS");
  });
});
