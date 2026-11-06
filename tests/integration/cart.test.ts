import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { addToCart, getCart, removeFromCart, setCartItemQuantity } from "@/server/cart/cart-service";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";
import { firstInactiveProductId, firstOutOfStockProductId, setAvailability } from "./fixtures";

const { db, close } = createDb(testDatabaseUrl());
const P = "MN-MON-0001"; // 35 unidades en el dataset

let session: string;
beforeEach(async () => {
  await resetOperationalState(db, DATASET_PATH);
  session = randomUUID();
});
afterAll(async () => close());

describe("carrito", () => {
  it("suma cantidades del mismo producto en una línea", async () => {
    await addToCart(db, session, P, 2);
    const { cart, previousQuantity } = await addToCart(db, session, P, 1);
    expect(previousQuantity).toBe(2);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.totalCents).toBe(3 * 46862);
    expect(cart.itemCount).toBe(3);
  });

  it("rechaza agregar más que lo disponible sin modificar el carrito", async () => {
    await addToCart(db, session, P, 30);
    await expect(addToCart(db, session, P, 10)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await getCart(db, session)).lines[0].quantity).toBe(30);
  });

  it("rechaza productos discontinuados", async () => {
    await expect(addToCart(db, session, await firstInactiveProductId(db), 1)).rejects.toMatchObject({
      code: "PRODUCT_INACTIVE",
    });
  });

  it("rechaza productos sin stock", async () => {
    await expect(addToCart(db, session, await firstOutOfStockProductId(db), 1)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("rechaza productos inexistentes", async () => {
    await expect(addToCart(db, session, "NOPE", 1)).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });

  it("marca la línea si el stock bajó después de agregarla", async () => {
    await addToCart(db, session, P, 5);
    await setAvailability(db, P, 3);
    const cart = await getCart(db, session);
    expect(cart.lines[0].issue).toBe("INSUFFICIENT_STOCK");
    expect(cart.hasIssues).toBe(true);
  });

  it("cambia la cantidad y quita líneas devolviendo la cantidad anterior", async () => {
    await addToCart(db, session, P, 2);
    const set = await setCartItemQuantity(db, session, P, 4);
    expect(set.previousQuantity).toBe(2);
    expect(set.cart.lines[0].quantity).toBe(4);
    await expect(setCartItemQuantity(db, session, P, 0)).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    const removed = await removeFromCart(db, session, P);
    expect(removed.previousQuantity).toBe(4);
    expect(removed.cart.lines).toHaveLength(0);
  });

  it("mantiene carritos independientes por sesión", async () => {
    const other = randomUUID();
    await addToCart(db, session, P, 1);
    expect((await getCart(db, other)).lines).toHaveLength(0);
  });

  it("devuelve un carrito vacío para una sesión nueva", async () => {
    const cart = await getCart(db, randomUUID());
    expect(cart).toMatchObject({ lines: [], totalCents: 0, itemCount: 0, hasIssues: false });
  });
});

describe("fixtures", () => {
  it("setAvailability deja el total pedido", async () => {
    await setAvailability(db, P, 3);
    const [r] = await db.execute<{ n: string }>(
      sql`select sum(available_qty) as n from inventory where product_id = ${P}`,
    );
    expect(Number(r.n)).toBe(3);
  });
});
