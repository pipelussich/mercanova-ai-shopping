import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { lineIssue, summarizeCart, validateQuantity, type CartLineIssue } from "@/domain/cart";
import { DomainError } from "@/domain/errors";
import { SUMMARY_COLUMNS, type SummaryRow } from "../catalog/catalog-repo";
import { toSummary, type ProductSummary } from "../catalog/catalog-service";

export type CartLine = {
  product: ProductSummary;
  quantity: number;
  lineTotalCents: number;
  issue: CartLineIssue | null;
};

export type Cart = {
  lines: CartLine[];
  totalCents: number;
  itemCount: number;
  hasIssues: boolean;
};

export type CartMutation = { cart: Cart; previousQuantity: number };

type Executor = Pick<DB, "execute">;

export async function ensureSession(db: Executor, sessionId: string): Promise<void> {
  await db.execute(sql`insert into sessions (id) values (${sessionId}) on conflict do nothing`);
}

export async function getCart(db: Executor, sessionId: string): Promise<Cart> {
  const rows = await db.execute<SummaryRow & { quantity: number }>(sql`
    select ${SUMMARY_COLUMNS}, 0 as total, c.quantity
    from cart_items c
    join products p on p.id = c.product_id
    join prices pr on pr.product_id = p.id
    where c.session_id = ${sessionId}
    order by c.added_at, p.id`);
  const lines: CartLine[] = rows.map((r) => {
    const product = toSummary(r);
    return {
      product,
      quantity: r.quantity,
      lineTotalCents: r.quantity * product.priceCents,
      issue: lineIssue(r.quantity, product.availableQty, product.active),
    };
  });
  return {
    lines,
    ...summarizeCart(lines.map((l) => ({ quantity: l.quantity, priceCents: l.product.priceCents, issue: l.issue }))),
  };
}

async function productState(db: Executor, productId: string) {
  const [row] = await db.execute<{ active: boolean; available: string }>(sql`
    select p.active, (select coalesce(sum(available_qty),0) from inventory i where i.product_id = p.id) as available
    from products p where p.id = ${productId}`);
  if (!row) throw new DomainError("PRODUCT_NOT_FOUND");
  return { active: row.active, available: Number(row.available) };
}

async function currentQuantity(db: Executor, sessionId: string, productId: string): Promise<number> {
  const [row] = await db.execute<{ quantity: number }>(sql`
    select quantity from cart_items where session_id = ${sessionId} and product_id = ${productId}`);
  return row?.quantity ?? 0;
}

async function writeQuantity(db: Executor, sessionId: string, productId: string, quantity: number) {
  await db.execute(sql`
    insert into cart_items (session_id, product_id, quantity) values (${sessionId}, ${productId}, ${quantity})
    on conflict (session_id, product_id) do update set quantity = excluded.quantity`);
}

/** Agrega `qty` unidades a la línea del producto (validando el total resultante contra el stock actual). */
export async function addToCart(db: DB, sessionId: string, productId: string, qty: number): Promise<CartMutation> {
  if (!Number.isInteger(qty) || qty < 1) validateQuantity(qty, Infinity, true);
  return db.transaction(async (tx) => {
    const { active, available } = await productState(tx, productId);
    const previousQuantity = await currentQuantity(tx, sessionId, productId);
    validateQuantity(previousQuantity + qty, available, active);
    await ensureSession(tx, sessionId);
    await writeQuantity(tx, sessionId, productId, previousQuantity + qty);
    return { cart: await getCart(tx, sessionId), previousQuantity };
  });
}

/** Fija la cantidad exacta de una línea. */
export async function setCartItemQuantity(
  db: DB,
  sessionId: string,
  productId: string,
  qty: number,
): Promise<CartMutation> {
  return db.transaction(async (tx) => {
    const { active, available } = await productState(tx, productId);
    validateQuantity(qty, available, active);
    const previousQuantity = await currentQuantity(tx, sessionId, productId);
    await ensureSession(tx, sessionId);
    await writeQuantity(tx, sessionId, productId, qty);
    return { cart: await getCart(tx, sessionId), previousQuantity };
  });
}

export async function removeFromCart(db: DB, sessionId: string, productId: string): Promise<CartMutation> {
  return db.transaction(async (tx) => {
    const previousQuantity = await currentQuantity(tx, sessionId, productId);
    await tx.execute(sql`delete from cart_items where session_id = ${sessionId} and product_id = ${productId}`);
    return { cart: await getCart(tx, sessionId), previousQuantity };
  });
}

export async function clearCart(db: Executor, sessionId: string): Promise<void> {
  await db.execute(sql`delete from cart_items where session_id = ${sessionId}`);
}
