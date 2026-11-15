/**
 * Regenera src/domain/product-photo-ids.ts con los productos que tienen foto en public/products/{id}.jpg.
 * Uso: npx tsx scripts/sync-product-photos.ts
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ids = readdirSync(path.resolve("public/products"))
  .filter((f) => /^MN-[A-Z]+-\d{4}\.jpg$/.test(f))
  .map((f) => f.replace(/\.jpg$/, ""))
  .sort();

writeFileSync(
  path.resolve("src/domain/product-photo-ids.ts"),
  "// Generado por scripts/sync-product-photos.ts a partir de public/products/*.jpg. No editar a mano.\n" +
    `export const PRODUCT_PHOTO_ID_LIST: readonly string[] = ${JSON.stringify(ids, null, 2)};\n`,
);
console.log(`${ids.length} fotos de producto`);
