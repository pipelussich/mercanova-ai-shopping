import { tool } from "ai";
import { z } from "zod";
import { getCart } from "@/server/cart/cart-service";
import { getOrder, listOrders, type Order } from "@/server/orders/order-service";
import { usd, type ToolContext } from "./context";

function summary(o: Order) {
  return {
    id: o.id,
    createdAt: o.createdAt,
    status: o.status,
    totalUsd: usd(o.totalCents),
    deliveryMethod: o.deliveryMethod,
    items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity, unitPriceUsd: usd(i.unitPriceCents) })),
  };
}

/**
 * Lectura de órdenes y propuesta de checkout. Deliberadamente NO hay ninguna tool que cree órdenes:
 * la compra sólo se registra cuando el usuario confirma en la pantalla de checkout (RF-12).
 */
export function orderTools(ctx: ToolContext) {
  return {
    get_orders: tool({
      description: "List the user's past orders, or get one order by id.",
      inputSchema: z.object({ orderId: z.string().optional() }),
      execute: async ({ orderId }) => {
        if (orderId) {
          const o = await getOrder(ctx.db, ctx.sessionId, orderId);
          return o ? { orders: [summary(o)] } : { orders: [], error: "ORDER_NOT_FOUND" as const };
        }
        return { orders: (await listOrders(ctx.db, ctx.sessionId)).slice(0, 10).map(summary) };
      },
    }),

    propose_checkout: tool({
      description:
        "Use when the user wants to buy / finish the purchase. You CANNOT place orders: this only checks whether the " +
        "cart is ready and gives the user a button to the checkout screen, where they confirm the purchase themselves.",
      inputSchema: z.object({}),
      execute: async () => {
        const cart = await getCart(ctx.db, ctx.sessionId);
        const issues = [
          ...(cart.lines.length === 0 ? ["El carrito está vacío."] : []),
          ...cart.lines
            .filter((l) => l.issue)
            .map((l) =>
              l.issue === "INACTIVE"
                ? `${l.product.name} está discontinuado.`
                : `${l.product.name}: sólo quedan ${l.product.availableQty} unidades.`,
            ),
        ];
        return {
          ready: issues.length === 0,
          issues,
          totalUsd: usd(cart.totalCents),
          checkoutUrl: "/checkout" as const,
        };
      },
    }),
  };
}
