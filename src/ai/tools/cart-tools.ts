import { tool } from "ai";
import { z } from "zod";
import { addToCart, getCart, removeFromCart, setCartItemQuantity, type Cart } from "@/server/cart/cart-service";
import { asToolResult, usd, type ToolContext } from "./context";

export function cartSnapshot(cart: Cart) {
  return {
    lines: cart.lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      quantity: l.quantity,
      unitPriceUsd: usd(l.product.priceCents),
      lineTotalUsd: usd(l.lineTotalCents),
      availableQty: l.product.availableQty,
      issue: l.issue,
    })),
    itemCount: cart.itemCount,
    totalUsd: usd(cart.totalCents),
    hasIssues: cart.hasIssues,
  };
}

const ONLY_IF_ASKED = "Only call it when the user explicitly asked to change the cart.";

export function cartTools(ctx: ToolContext) {
  const nameOf = (cart: Cart, productId: string) => cart.lines.find((l) => l.product.id === productId)?.product.name;

  return {
    get_cart: tool({
      description: "Get the user's current cart with current prices (USD), quantities, total and stock issues.",
      inputSchema: z.object({}),
      execute: async () => cartSnapshot(await getCart(ctx.db, ctx.sessionId)),
    }),

    add_to_cart: tool({
      description: `Add units of a product to the user's cart (validated against current stock). ${ONLY_IF_ASKED}`,
      inputSchema: z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99).default(1) }),
      execute: async ({ productId, quantity }) =>
        asToolResult(async () => {
          const { cart, previousQuantity } = await addToCart(ctx.db, ctx.sessionId, productId, quantity);
          return {
            ok: true as const,
            action: "add" as const,
            productId,
            productName: nameOf(cart, productId) ?? productId,
            quantity: previousQuantity + quantity,
            previousQuantity,
            cart: cartSnapshot(cart),
          };
        }),
    }),

    update_cart_item: tool({
      description: `Set the exact quantity of a product already in the cart. ${ONLY_IF_ASKED}`,
      inputSchema: z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) }),
      execute: async ({ productId, quantity }) =>
        asToolResult(async () => {
          const { cart, previousQuantity } = await setCartItemQuantity(ctx.db, ctx.sessionId, productId, quantity);
          return {
            ok: true as const,
            action: "update" as const,
            productId,
            productName: nameOf(cart, productId) ?? productId,
            quantity,
            previousQuantity,
            cart: cartSnapshot(cart),
          };
        }),
    }),

    remove_from_cart: tool({
      description: `Remove a product from the cart. ${ONLY_IF_ASKED}`,
      inputSchema: z.object({ productId: z.string() }),
      execute: async ({ productId }) =>
        asToolResult(async () => {
          const before = await getCart(ctx.db, ctx.sessionId);
          const { cart, previousQuantity } = await removeFromCart(ctx.db, ctx.sessionId, productId);
          return {
            ok: true as const,
            action: "remove" as const,
            productId,
            productName: nameOf(before, productId) ?? productId,
            quantity: 0,
            previousQuantity,
            cart: cartSnapshot(cart),
          };
        }),
    }),
  };
}
