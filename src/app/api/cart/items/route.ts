import { z } from "zod";
import { requestDb } from "@/server/request-db";
import { addToCart } from "@/server/cart/cart-service";
import { getSessionId } from "@/server/session";
import { handleRoute, readJson } from "../../_lib/respond";

const body = z.object({
  productId: z.string({ error: "Falta el producto." }).min(1, "Falta el producto."),
  quantity: z.number({ error: "La cantidad tiene que ser un número." }).default(1),
});

export async function POST(req: Request) {
  return handleRoute(async () => {
    const { productId, quantity } = body.parse(await readJson(req));
    return Response.json(await addToCart(await requestDb(), await getSessionId(), productId, quantity));
  });
}
