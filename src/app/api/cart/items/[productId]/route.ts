import { z } from "zod";
import { getDb } from "@/db/client";
import { removeFromCart, setCartItemQuantity } from "@/server/cart/cart-service";
import { getSessionId } from "@/server/session";
import { handleRoute, readJson } from "../../../_lib/respond";

const body = z.object({ quantity: z.number({ error: "La cantidad tiene que ser un número." }) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/cart/items/[productId]">) {
  return handleRoute(async () => {
    const { productId } = await ctx.params;
    const { quantity } = body.parse(await readJson(req));
    return Response.json(await setCartItemQuantity(getDb(), await getSessionId(), decodeURIComponent(productId), quantity));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/cart/items/[productId]">) {
  return handleRoute(async () => {
    const { productId } = await ctx.params;
    return Response.json(await removeFromCart(getDb(), await getSessionId(), decodeURIComponent(productId)));
  });
}
