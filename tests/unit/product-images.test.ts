import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_PHOTO_IDS, productImageUrl } from "@/domain/product-images";

const photo = (id: string) => path.resolve(__dirname, "../../public/products", `${id}.jpg`);

describe("productImageUrl", () => {
  it("usa la foto propia del producto", () => {
    const id = [...PRODUCT_PHOTO_IDS][0];
    expect(productImageUrl({ id, imageUrl: "https://placehold.co/x" })).toBe(`/products/${id}.jpg`);
  });

  it("cae a la imagen del dataset si el producto no tiene foto", () => {
    expect(productImageUrl({ id: "MN-XXX-9999", imageUrl: "https://placehold.co/y" })).toBe("https://placehold.co/y");
  });

  it("hay una foto para cada producto del catálogo", () => {
    expect(PRODUCT_PHOTO_IDS.size).toBe(360);
    for (const id of PRODUCT_PHOTO_IDS) expect(existsSync(photo(id)), id).toBe(true);
  });

  it("no hay dos productos con la misma foto", () => {
    const seen = new Map<string, string>();
    for (const id of PRODUCT_PHOTO_IDS) {
      const hash = createHash("md5").update(readFileSync(photo(id))).digest("hex");
      expect(seen.get(hash), `${id} repite la foto de ${seen.get(hash)}`).toBeUndefined();
      seen.set(hash, id);
    }
  });
});
