import { cartTools } from "./cart-tools";
import { catalogTools } from "./catalog-tools";
import type { ToolContext } from "./context";
import { orderTools } from "./order-tools";

export type { ToolContext } from "./context";

/** Capacidades reales de la app expuestas al modelo. Ninguna registra compras. */
export function buildTools(ctx: ToolContext) {
  return { ...catalogTools(ctx), ...cartTools(ctx), ...orderTools(ctx) };
}

export type AssistantTools = ReturnType<typeof buildTools>;
