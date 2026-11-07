import { requestDb } from "@/server/request-db";
import { getCart } from "@/server/cart/cart-service";
import { getSessionId } from "@/server/session";
import { handleRoute } from "../_lib/respond";

export async function GET() {
  return handleRoute(async () => Response.json(await getCart(await requestDb(), await getSessionId())));
}
