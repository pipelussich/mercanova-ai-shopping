import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { stockStatus } from "@/domain/stock";

export async function firstInactiveProductId(db: DB): Promise<string> {
  const [r] = await db.execute<{ id: string }>(sql`select id from products where not active order by id limit 1`);
  return r.id;
}

/** Producto activo cuya disponibilidad total es 0 en el dataset. */
export async function firstOutOfStockProductId(db: DB): Promise<string> {
  const [r] = await db.execute<{ id: string }>(sql`
    select p.id from products p join inventory i on i.product_id = p.id
    where p.active group by p.id having sum(i.available_qty) = 0 order by p.id limit 1`);
  return r.id;
}

/** Deja la disponibilidad total del producto en `total`, concentrada en el primer depósito. */
export async function setAvailability(db: DB, productId: string, total: number): Promise<void> {
  await db.execute(sql`
    update inventory set available_qty = 0, on_hand_qty = reserved_qty, status = 'Out of stock'
    where product_id = ${productId}`);
  await db.execute(sql`
    update inventory set available_qty = ${total}, on_hand_qty = reserved_qty + ${total}, status = ${stockStatus(total)}
    where product_id = ${productId}
      and warehouse_id = (select min(warehouse_id) from inventory where product_id = ${productId})`);
}

export async function availability(db: DB, productId: string): Promise<number> {
  const [r] = await db.execute<{ n: string }>(
    sql`select coalesce(sum(available_qty),0) as n from inventory where product_id = ${productId}`,
  );
  return Number(r.n);
}
