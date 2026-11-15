import { PRODUCT_PHOTO_ID_LIST } from "./product-photo-ids";

/**
 * El dataset trae imágenes de relleno (placehold.co). Cada producto tiene una foto propia en
 * public/products/{id}.jpg. El dato de la base no cambia.
 */
export const PRODUCT_PHOTO_IDS: ReadonlySet<string> = new Set(PRODUCT_PHOTO_ID_LIST);

export function productImageUrl(p: { id: string; imageUrl: string | null }): string {
  return PRODUCT_PHOTO_IDS.has(p.id) ? `/products/${p.id}.jpg` : (p.imageUrl ?? "");
}
