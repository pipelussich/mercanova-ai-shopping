import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSessionId } from "./session-cookie";

/**
 * Id de la sesión anónima del visitante. `src/proxy.ts` la crea antes de cualquier request,
 * así que acá sólo se lee. Si faltara (request fuera del matcher) se lanza un error explícito.
 */
export async function getSessionId(): Promise<string> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(id)) throw new Error("Sesión ausente: la request no pasó por src/proxy.ts");
  return id;
}
