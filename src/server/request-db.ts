import { connection } from "next/server";
import { getDb, type DB } from "@/db/client";

/**
 * Acceso a la base desde páginas y route handlers. `connection()` marca la request como dinámica:
 * stock, precios, carrito y órdenes nunca se prerenderizan en el build (que además corre sin base de datos).
 */
export async function requestDb(): Promise<DB> {
  await connection();
  return getDb();
}
