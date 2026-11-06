export type StockStatus = "Out of stock" | "Low stock" | "In stock";

/** Umbrales tomados del dataset: 0 sin stock, 1–2 pocas unidades, 3+ en stock. */
export function stockStatus(available: number): StockStatus {
  if (available <= 0) return "Out of stock";
  if (available <= 2) return "Low stock";
  return "In stock";
}

const LABELS: Record<StockStatus, string> = {
  "Out of stock": "Sin stock",
  "Low stock": "Últimas unidades",
  "In stock": "En stock",
};

export function stockLabelEs(status: StockStatus): string {
  return LABELS[status];
}
