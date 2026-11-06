export type DomainErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "INSUFFICIENT_STOCK"
  | "CART_EMPTY"
  | "INVALID_QUANTITY"
  | "PRICE_CHANGED"
  | "INVALID_CHECKOUT"
  | "PICKUP_UNAVAILABLE"
  | "ORDER_NOT_FOUND";

const DEFAULT_MESSAGES: Record<DomainErrorCode, string> = {
  PRODUCT_NOT_FOUND: "No encontramos ese producto.",
  PRODUCT_INACTIVE: "Ese producto está discontinuado y no se puede comprar.",
  INSUFFICIENT_STOCK: "No hay stock suficiente para esa cantidad.",
  CART_EMPTY: "Tu carrito está vacío.",
  INVALID_QUANTITY: "La cantidad no es válida.",
  PRICE_CHANGED: "Los precios cambiaron desde que revisaste tu compra. Revisá el nuevo total antes de confirmar.",
  INVALID_CHECKOUT: "Revisá los datos de la compra.",
  PICKUP_UNAVAILABLE: "El depósito elegido no tiene stock suficiente para retirar tu pedido.",
  ORDER_NOT_FOUND: "No encontramos esa orden.",
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
