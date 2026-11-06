import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { AssistantTools } from "@/ai/tools";

export type AssistantUIMessage = UIMessage<{ voice?: boolean }, UIDataTypes, InferUITools<AssistantTools>>;

export const TOOL_STATUS_ES: Record<string, string> = {
  search_products: "Buscando productos…",
  get_product_details: "Consultando el producto…",
  compare_products: "Comparando productos…",
  get_related_products: "Buscando alternativas…",
  get_cart: "Revisando tu carrito…",
  add_to_cart: "Agregando al carrito…",
  update_cart_item: "Actualizando el carrito…",
  remove_from_cart: "Quitando del carrito…",
  get_orders: "Consultando tus órdenes…",
  propose_checkout: "Preparando el checkout…",
};

export const CART_TOOLS = new Set(["add_to_cart", "update_cart_item", "remove_from_cart"]);
