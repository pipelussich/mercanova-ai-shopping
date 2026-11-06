import { describe, expect, it } from "vitest";
import { buildSearchDocument, contentHash, matchReasons } from "@/server/search/search-document";

const product = {
  name: "Flux Vision 24 QHD IPS",
  brand: "Flux",
  category: "Monitors",
  subcategory: "Gaming",
  shortDescription: "24-inch QHD IPS monitor with 240 Hz refresh rate.",
  description: "Flux Vision 24 QHD IPS is designed for office work.",
  recommendedFor: ["office work", "programming"],
  notRecommendedFor: [],
  keyFeatures: ["24-inch", "QHD", "240 Hz"],
  tags: ["monitor", "display"],
  specs: [{ group: "Display", name: "Refresh Rate", value: "240 Hz" }],
};

describe("buildSearchDocument", () => {
  it("incluye nombre, categoría, usos recomendados y specs", () => {
    const doc = buildSearchDocument(product);
    expect(doc).toContain("Flux Vision 24 QHD IPS");
    expect(doc).toContain("Category: Monitors / Gaming");
    expect(doc).toContain("Recommended for: office work, programming");
    expect(doc).toContain("Refresh Rate: 240 Hz");
    expect(doc).not.toContain("Not recommended for");
  });
});

describe("contentHash", () => {
  it("es estable y cambia con el contenido", () => {
    const doc = buildSearchDocument(product);
    expect(contentHash(doc)).toBe(contentHash(doc));
    expect(contentHash(doc)).not.toBe(contentHash(doc + " "));
  });
});

describe("matchReasons", () => {
  it("devuelve los usos y features que comparten palabras con la consulta", () => {
    expect(matchReasons("monitor for programming at 240 Hz", product)).toEqual(["programming", "240 Hz"]);
  });

  it("devuelve una lista vacía si nada coincide", () => {
    expect(matchReasons("auriculares", product)).toEqual([]);
  });
});
