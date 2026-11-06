import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { z } from "zod";
import { createAgentStream } from "@/ai/agent";
import { queryEmbedder } from "@/ai/embeddings";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { clearMessages, loadMessages, saveMessages } from "@/server/chat/chat-repo";
import { getSessionId } from "@/server/session";
import { errorResponse, handleRoute, readJson } from "../_lib/respond";

export const maxDuration = 60;

const body = z.object({
  message: z.object({
    id: z.string().min(1),
    role: z.literal("user"),
    parts: z
      .array(z.looseObject({ type: z.string() }))
      .min(1)
      .refine((parts) => parts.some((p) => p.type === "text" && typeof p.text === "string" && p.text.trim()), {
        message: "El mensaje está vacío.",
      }),
  }),
});

/** El cliente manda sólo el mensaje nuevo; el historial sale de la DB (estado persistido por sesión). */
export async function POST(req: Request) {
  return handleRoute(async () => {
    if (!getEnv().hasAI)
      return errorResponse(
        503,
        "AI_DISABLED",
        "El asistente no está configurado (falta GEMINI_API_KEY). La tienda funciona normalmente.",
      );
    const { message } = body.parse(await readJson(req));
    const text = String(message.parts.find((p) => p.type === "text")?.text ?? "");
    if (text.length > 2000)
      return errorResponse(422, "MESSAGE_TOO_LONG", "El mensaje es demasiado largo (máx. 2000 caracteres).");

    const db = getDb();
    const sessionId = await getSessionId();
    const history = await loadMessages(db, sessionId);
    const messages = [...history.filter((m) => m.id !== message.id), message as UIMessage];

    const stream = createAgentStream({
      db,
      sessionId,
      messages,
      embedQuery: queryEmbedder(),
      onFinish: (all) => saveMessages(db, sessionId, all),
    });
    return createUIMessageStreamResponse({ stream });
  });
}

export async function GET() {
  return handleRoute(async () => {
    const messages = await loadMessages(getDb(), await getSessionId());
    return Response.json({ messages, enabled: getEnv().hasAI });
  });
}

export async function DELETE() {
  return handleRoute(async () => {
    await clearMessages(getDb(), await getSessionId());
    return new Response(null, { status: 204 });
  });
}
