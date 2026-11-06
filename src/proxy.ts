import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, isValidSessionId } from "@/server/session-cookie";

/**
 * Garantiza que todo visitante tenga una sesión anónima (cookie httpOnly) antes de que
 * Server Components o route handlers la lean. Sin login: la sesión agrupa carrito, órdenes y chat.
 */
export function proxy(req: NextRequest) {
  const current = req.cookies.get(SESSION_COOKIE)?.value;
  if (current && isValidSessionId(current)) return NextResponse.next();

  const id = crypto.randomUUID();
  // Se reenvía en el request para que `cookies()` la vea ya en esta misma petición.
  const headers = new Headers(req.headers);
  const others = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${SESSION_COOKIE}=`));
  headers.set("cookie", [...others, `${SESSION_COOKIE}=${id}`].join("; "));

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export const config = {
  // Todo menos assets estáticos y la subida de audio (que no usa sesión y puede superar el buffer del proxy).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/transcribe|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
