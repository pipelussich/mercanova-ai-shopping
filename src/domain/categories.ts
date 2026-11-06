/** Nombres de categoría del dataset (en inglés) → etiqueta para la UI. El dato guardado no cambia. */
export const CATEGORY_LABELS_ES: Record<string, string> = {
  Monitors: "Monitores",
  Laptops: "Notebooks",
  Headphones: "Auriculares",
  Keyboards: "Teclados",
  Mice: "Mouses",
  Webcams: "Webcams",
  "Docking Stations": "Docking stations",
  "External Storage": "Almacenamiento externo",
  Routers: "Routers",
  Speakers: "Parlantes",
  Printers: "Impresoras",
  Tablets: "Tablets",
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS_ES);

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS_ES[category] ?? category;
}

export const RELATION_LABELS_ES: Record<string, string> = {
  alternative_to: "Alternativas",
  accessory_for: "Accesorios",
  often_bought_with: "Se compran juntos",
};
