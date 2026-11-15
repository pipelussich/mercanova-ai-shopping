/**
 * Eval de la búsqueda del catálogo con structured output y Gemini real: `npm run evals`.
 * Cada caso es una búsqueda escrita como la escribiría alguien y los campos que el objeto tiene que traer.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { understandQuery, type ShoppingQuery } from "@/ai/query-understanding";

if (existsSync(".env")) process.loadEnvFile(".env");

type Case = { text: string; expect: Partial<ShoppingQuery> };

const CASES: Case[] = [
  { text: "notebook liviana para la facu hasta 900 dólares", expect: { category: "Laptops", maxPriceUsd: 900 } },
  { text: "el mouse más barato que tengan en stock", expect: { category: "Mice", sortBy: "price_asc", inStockOnly: true } },
  { text: "auriculares sony con cancelación de ruido", expect: { category: "Headphones", brand: "Sony" } },
  { text: "monitor 4k para diseño entre 300 y 600", expect: { category: "Monitors", minPriceUsd: 300, maxPriceUsd: 600 } },
  { text: "algo para escuchar música en el living", expect: { brand: null, maxPriceUsd: null } },
  { text: "la impresora mejor puntuada", expect: { category: "Printers", sortBy: "rating" } },
];

const rows: string[] = [];

describe.skipIf(!process.env.GEMINI_API_KEY)("búsqueda con structured output (Gemini real)", () => {
  for (const c of CASES) {
    it(c.text, async () => {
      const out = await understandQuery(c.text, { cache: false, timeoutMs: 20_000 });
      const failures = out
        ? Object.entries(c.expect)
            .filter(([k, v]) => out[k as keyof ShoppingQuery] !== v)
            .map(([k, v]) => `${k}: esperaba ${JSON.stringify(v)}, vino ${JSON.stringify(out[k as keyof ShoppingQuery])}`)
        : ["no devolvió un objeto válido"];
      rows.push(`| ${c.text} | \`${JSON.stringify(out)}\` | ${failures.length ? failures.join("; ") : "OK"} |`);
      await new Promise((r) => setTimeout(r, 4_000)); // free tier
      expect(failures).toEqual([]);
    });
  }

  afterAll(() => {
    const ok = rows.filter((r) => r.endsWith("| OK |")).length;
    writeFileSync(
      path.resolve("evals/last-report-busqueda.md"),
      `# Eval de búsqueda con structured output\n\n${new Date().toISOString()} · ${ok}/${rows.length} OK\n\n` +
        "| Búsqueda | Objeto devuelto | Resultado |\n|---|---|---|\n" +
        rows.join("\n") +
        "\n",
    );
  });
});
