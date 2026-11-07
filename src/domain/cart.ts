import { DomainError } from "./errors";

export const MAX_QTY_PER_LINE = 99;

export type CartLineIssue = "INSUFFICIENT_STOCK" | "INACTIVE";

/** Valida la cantidad total que quedaría en el carrito para un producto. */
export function validateQuantity(requested: number, available: number, active: boolean): void {
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_QTY_PER_LINE)
    throw new DomainError(
      "INVALID_QUANTITY",
      `La cantidad tiene que ser un número entero entre 1 y ${MAX_QTY_PER_LINE}.`,
    );
  if (!active) throw new DomainError("PRODUCT_INACTIVE");
  if (requested > available)
    throw new DomainError(
      "INSUFFICIENT_STOCK",
      available === 0
        ? "Este producto no tiene stock disponible."
        : `Sólo hay ${available} ${available === 1 ? "unidad disponible" : "unidades disponibles"}.`,
      { available },
    );
}

/** Problema de una línea ya guardada (el stock o el producto pudieron cambiar después de agregarla). */
export function lineIssue(quantity: number, available: number, active: boolean): CartLineIssue | null {
  if (!active) return "INACTIVE";
  if (quantity > available) return "INSUFFICIENT_STOCK";
  return null;
}

export function summarizeCart(lines: { quantity: number; priceCents: number; issue: CartLineIssue | null }[]) {
  return {
    totalCents: lines.reduce((s, l) => s + l.quantity * l.priceCents, 0),
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    hasIssues: lines.some((l) => l.issue !== null),
  };
}
