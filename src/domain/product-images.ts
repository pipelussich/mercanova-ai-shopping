/**
 * El dataset trae imágenes de relleno (placehold.co). Para mostrar algo más realista usamos fotos genéricas por
 * categoría (Creative Commons, ver public/products/CREDITOS.md). Es un complemento visual documentado: no cambia
 * el dato de la base.
 */
export const PRODUCT_PHOTOS: Record<string, string[]> = {
  Monitors: ["monitors-1.jpg", "monitors-2.jpg", "monitors-3.jpg"],
  Laptops: ["laptops-1.jpg", "laptops-2.jpg", "laptops-3.jpg"],
  Headphones: ["headphones-1.jpg", "headphones-2.jpg", "headphones-3.jpg"],
  Keyboards: ["keyboards-1.jpg", "keyboards-2.jpg", "keyboards-3.jpg"],
  Mice: ["mice-1.jpg", "mice-2.jpg", "mice-3.jpg"],
  Webcams: ["webcams-1.jpg", "webcams-2.jpg"],
  "Docking Stations": ["docking-stations-1.jpg", "docking-stations-2.jpg"],
  "External Storage": ["external-storage-1.jpg", "external-storage-2.jpg", "external-storage-3.jpg"],
  Routers: ["routers-1.jpg", "routers-2.jpg", "routers-3.jpg"],
  Speakers: ["speakers-1.jpg", "speakers-2.jpg", "speakers-3.jpg"],
  Printers: ["printers-1.jpg", "printers-2.jpg", "printers-3.jpg"],
  Tablets: ["tablets-1.jpg", "tablets-2.jpg", "tablets-3.jpg"],
};

/** Número del id (MN-MON-0007 → 7) para repartir las fotos de forma estable. */
function idNumber(id: string): number {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
}

export function productImageUrl(p: { id: string; category: string; imageUrl: string | null }): string {
  const photos = PRODUCT_PHOTOS[p.category];
  if (!photos?.length) return p.imageUrl ?? "";
  return `/products/${photos[idNumber(p.id) % photos.length]}`;
}
