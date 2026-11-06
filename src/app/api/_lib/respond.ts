import { ZodError } from "zod";
import { isDomainError, type DomainErrorCode } from "@/domain/errors";

const STATUS: Record<DomainErrorCode, number> = {
  PRODUCT_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  PRODUCT_INACTIVE: 409,
  INSUFFICIENT_STOCK: 409,
  PICKUP_UNAVAILABLE: 409,
  PRICE_CHANGED: 409,
  CART_EMPTY: 409,
  INVALID_QUANTITY: 422,
  INVALID_CHECKOUT: 422,
};

export type ApiError = { error: { code: string; message: string; details?: unknown } };

export function errorResponse(status: number, code: string, message: string, details?: unknown): Response {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } } satisfies ApiError, { status });
}

export class BadRequestError extends Error {}

/** Lee el body JSON; si no es JSON válido lanza un error que `handleRoute` traduce a 400. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError("El cuerpo de la solicitud no es JSON válido.");
  }
}

/** Traduce errores previsibles a respuestas claras en español; nunca expone stacks ni secretos. */
export async function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (isDomainError(err)) return errorResponse(STATUS[err.code], err.code, err.message, err.details);
    if (err instanceof ZodError)
      return errorResponse(422, "VALIDATION_ERROR", err.issues[0]?.message ?? "Datos inválidos.", {
        fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    if (err instanceof BadRequestError) return errorResponse(400, "BAD_REQUEST", err.message);
    console.error("[api] error inesperado:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    return errorResponse(500, "INTERNAL", "Ocurrió un error inesperado. Probá de nuevo.");
  }
}
