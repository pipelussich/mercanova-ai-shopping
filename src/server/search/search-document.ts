import { createHash } from "node:crypto";

export type SearchableProduct = {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  description: string;
  recommendedFor: string[];
  notRecommendedFor: string[];
  keyFeatures: string[];
  tags: string[];
  specs: { group: string; name: string; value: string }[];
};

/** Texto que se embebe por producto: todo lo que describe para qué sirve y cómo es. */
export function buildSearchDocument(p: SearchableProduct): string {
  const lines = [
    p.name,
    `Brand: ${p.brand}`,
    `Category: ${p.category} / ${p.subcategory}`,
    p.shortDescription,
    p.description,
    p.recommendedFor.length ? `Recommended for: ${p.recommendedFor.join(", ")}` : "",
    p.notRecommendedFor.length ? `Not recommended for: ${p.notRecommendedFor.join(", ")}` : "",
    p.keyFeatures.length ? `Key features: ${p.keyFeatures.join(", ")}` : "",
    p.tags.length ? `Tags: ${p.tags.join(", ")}` : "",
    ...p.specs.map((s) => `${s.name}: ${s.value}`),
  ];
  return lines.filter(Boolean).join("\n");
}

export function contentHash(doc: string): string {
  return createHash("sha256").update(doc).digest("hex");
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2),
  );

/** Hasta 3 usos/features del producto que comparten palabras con la consulta (para explicar el resultado). */
export function matchReasons(query: string, p: Pick<SearchableProduct, "recommendedFor" | "keyFeatures">): string[] {
  const q = tokens(query);
  return [...p.recommendedFor, ...p.keyFeatures].filter((r) => [...tokens(r)].some((t) => q.has(t))).slice(0, 3);
}
