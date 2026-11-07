import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PRODUCT_PHOTOS, productImageUrl } from "@/domain/product-images";

describe("productImageUrl", () => {
  it("usa una foto local de la categoría del producto", () => {
    const url = productImageUrl({ id: "MN-HDP-0021", category: "Headphones", imageUrl: "https://placehold.co/x" });
    expect(url).toMatch(/^\/products\/headphones-[1-3]\.jpg$/);
  });

  it("es determinística: el mismo producto siempre muestra la misma foto", () => {
    const p = { id: "MN-MON-0001", category: "Monitors", imageUrl: null };
    expect(productImageUrl(p)).toBe(productImageUrl(p));
  });

  it("reparte las fotos entre los productos de una categoría", () => {
    const urls = new Set(
      Array.from({ length: 30 }, (_, i) =>
        productImageUrl({ id: `MN-MON-${String(i + 1).padStart(4, "0")}`, category: "Monitors", imageUrl: null }),
      ),
    );
    expect(urls.size).toBe(3);
  });

  it("cae a la imagen del dataset si la categoría no tiene fotos", () => {
    expect(productImageUrl({ id: "X", category: "Drones", imageUrl: "https://placehold.co/y" })).toBe(
      "https://placehold.co/y",
    );
  });

  it("todas las fotos declaradas existen en public/products", () => {
    for (const files of Object.values(PRODUCT_PHOTOS))
      for (const f of files) expect(existsSync(path.resolve(__dirname, "../../public/products", f))).toBe(true);
    expect(Object.keys(PRODUCT_PHOTOS)).toHaveLength(12);
  });
});
