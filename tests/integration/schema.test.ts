import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());

afterAll(async () => close());

describe("schema", () => {
  it("rechaza inventario con disponibilidad negativa", async () => {
    await expect(
      db.execute(sql`
        insert into inventory (product_id, warehouse_id, on_hand_qty, reserved_qty, available_qty, status, updated_at)
        values ('X', 'Y', 0, 0, -1, 'Out of stock', now())`),
    ).rejects.toThrow();
  });

  it("no permite dos órdenes con la misma idempotency_key", async () => {
    await db.execute(
      sql`insert into sessions (id) values ('00000000-0000-4000-8000-000000000001') on conflict do nothing`,
    );
    const insert = (id: string) =>
      db.execute(sql`
        insert into orders (id, session_id, idempotency_key, customer_name, email, phone, delivery_method, total_cents)
        values (${id}, '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
                'Ana', 'ana@example.com', '099123456', 'shipping', 100)`);
    try {
      await insert("MN-ORD-TEST-0001");
      await expect(insert("MN-ORD-TEST-0002")).rejects.toThrow();
    } finally {
      await db.execute(sql`delete from orders where id like 'MN-ORD-TEST-%'`);
    }
  });

  it("tiene la secuencia de números de orden", async () => {
    const rows = await db.execute<{ n: string }>(sql`select nextval('order_number_seq') as n`);
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(1);
  });
});
