import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { CATEGORIES, CATEGORY_LABELS_ES } from "@/domain/categories";
import type { SearchQuery, SortBy } from "@/server/search/search-service";
import { GOOGLE_PROVIDER_OPTIONS, withModelFallback } from "./provider";

/**
 * Lo que el modelo tiene que devolver al leer una búsqueda del catálogo. Todos los campos son obligatorios
 * (null cuando no aplica) para que Gemini no tenga que decidir qué omitir.
 */
export const ShoppingQuerySchema = z.object({
  searchText: z
    .string()
    .min(2)
    .describe("Short English description of the product need, without price, brand or sort words"),
  category: z.enum(CATEGORIES as [string, ...string[]]).nullable(),
  brand: z.string().nullable(),
  minPriceUsd: z.number().nonnegative().nullable(),
  maxPriceUsd: z.number().positive().nullable(),
  inStockOnly: z.boolean(),
  sortBy: z.enum(["relevance", "price_asc", "price_desc", "rating"]),
});

export type ShoppingQuery = z.infer<typeof ShoppingQuerySchema>;

const categories = Object.entries(CATEGORY_LABELS_ES)
  .map(([en, es]) => `${en} (${es})`)
  .join(", ");

const INSTRUCTIONS = `You turn a shopper's search box text (usually Spanish from Uruguay) into catalog filters for MercaNova, a tech store.
Categories: ${categories}.
Rules:
- Only fill a field when the text says it. Do not guess a brand or a budget.
- Prices are in US dollars. "hasta 900", "menos de 900 dólares" → maxPriceUsd 900. "más de 300" → minPriceUsd 300.
- "barato", "el más barato" → sortBy price_asc. "el mejor", "mejor puntuado" → sortBy rating. Otherwise relevance.
- "que haya", "en stock", "disponible" → inStockOnly true.
- searchText is the need in English for a semantic search (use case and features).

Examples:
"notebook liviana para la facu hasta 900 dólares" → {"searchText":"lightweight laptop for university","category":"Laptops","brand":null,"minPriceUsd":null,"maxPriceUsd":900,"inStockOnly":false,"sortBy":"relevance"}
"auriculares sony con cancelación de ruido" → {"searchText":"noise cancelling headphones","category":"Headphones","brand":"Sony","minPriceUsd":null,"maxPriceUsd":null,"inStockOnly":false,"sortBy":"relevance"}
"el monitor más barato que tengan en stock" → {"searchText":"monitor","category":"Monitors","brand":null,"minPriceUsd":null,"maxPriceUsd":null,"inStockOnly":true,"sortBy":"price_asc"}
"algo para hacer videollamadas desde casa" → {"searchText":"webcam or headset for video calls working from home","category":null,"brand":null,"minPriceUsd":null,"maxPriceUsd":null,"inStockOnly":false,"sortBy":"relevance"}`;

/** La búsqueda del catálogo no puede quedar esperando al modelo: si tarda más, se busca con el texto tal cual. */
export const UNDERSTAND_TIMEOUT_MS = 6_000;

const cache = new Map<string, ShoppingQuery>();
const CACHE_MAX = 200;

/**
 * Structured output: Gemini lee la búsqueda en lenguaje natural y devuelve un objeto que valida contra
 * ShoppingQuerySchema. Si falla (sin key, cuota, timeout, JSON fuera del schema) devuelve null.
 */
export async function understandQuery(
  text: string,
  opts: { models?: LanguageModel[]; timeoutMs?: number; cache?: boolean } = {},
): Promise<ShoppingQuery | null> {
  const key = text.trim().toLowerCase();
  const useCache = opts.cache ?? true;
  if (useCache && cache.has(key)) return cache.get(key)!;
  try {
    const { output } = await withModelFallback(
      (model) =>
        generateText({
          model,
          output: Output.object({ schema: ShoppingQuerySchema, name: "catalog_filters" }),
          system: INSTRUCTIONS,
          prompt: text,
          temperature: 0,
          maxRetries: 0,
          providerOptions: GOOGLE_PROVIDER_OPTIONS,
          abortSignal: AbortSignal.timeout(opts.timeoutMs ?? UNDERSTAND_TIMEOUT_MS),
        }),
      opts.models,
      { retriesPerModel: 0 },
    );
    if (useCache) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, output);
    }
    return output;
  } catch {
    return null;
  }
}

/**
 * Pasa el objeto del modelo a filtros del catálogo. La marca se valida contra las que existen, así un nombre
 * inventado por el modelo no vacía los resultados.
 */
export function toCatalogFilters(q: ShoppingQuery, brands: string[]): SearchQuery & { sortBy: SortBy } {
  const brand = q.brand ? brands.find((b) => b.toLowerCase() === q.brand!.toLowerCase()) : undefined;
  const maxPriceCents = q.maxPriceUsd != null ? Math.round(q.maxPriceUsd * 100) : undefined;
  let minPriceCents = q.minPriceUsd ? Math.round(q.minPriceUsd * 100) : undefined;
  if (minPriceCents != null && maxPriceCents != null && minPriceCents > maxPriceCents) minPriceCents = undefined;
  const f: SearchQuery & { sortBy: SortBy } = { query: q.searchText, inStockOnly: q.inStockOnly, sortBy: q.sortBy };
  if (q.category) f.category = q.category;
  if (brand) f.brand = brand;
  if (minPriceCents != null) f.minPriceCents = minPriceCents;
  if (maxPriceCents != null) f.maxPriceCents = maxPriceCents;
  return f;
}
