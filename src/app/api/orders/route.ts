import { z } from "zod";
import { requestDb } from "@/server/request-db";
import { listOrders, placeOrder } from "@/server/orders/order-service";
import { getSessionId } from "@/server/session";
import { handleRoute, readJson } from "../_lib/respond";

const confirmation = z.looseObject({
  idempotencyKey: z.uuid({ error: "Falta la clave de confirmación de la compra." }),
  expectedTotalCents: z.number().int().nonnegative(),
});

/** Única vía para registrar una compra: la llama la pantalla de confirmación tras el click explícito del usuario. */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = confirmation.parse(await readJson(req));
    const order = await placeOrder(await requestDb(), await getSessionId(), body as Parameters<typeof placeOrder>[2]);
    return Response.json(order, { status: 201 });
  });
}

export async function GET() {
  return handleRoute(async () => Response.json(await listOrders(await requestDb(), await getSessionId())));
}
