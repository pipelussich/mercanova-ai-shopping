import type { UIMessage } from "ai";
import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { ensureSession } from "../cart/cart-service";

const MAX_HISTORY = 40;

/** Últimos mensajes de la conversación de la sesión (estado del chat persistido, RF-03). */
export async function loadMessages(db: Pick<DB, "execute">, sessionId: string): Promise<UIMessage[]> {
  const rows = await db.execute<{ id: string; role: UIMessage["role"]; parts: UIMessage["parts"] }>(sql`
    select id, role, parts from (
      select id, role, parts, created_at, seq from chat_messages where session_id = ${sessionId}
      order by created_at desc, seq desc limit ${MAX_HISTORY}
    ) t order by created_at, seq`);
  return rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts }));
}

/** Upsert de la conversación completa (los mensajes existentes se actualizan, los nuevos se agregan en orden). */
export async function saveMessages(db: DB, sessionId: string, messages: UIMessage[]): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureSession(tx, sessionId);
    for (const m of messages)
      await tx.execute(sql`
        insert into chat_messages (id, session_id, role, parts)
        values (${m.id}, ${sessionId}, ${m.role}, ${JSON.stringify(m.parts)}::jsonb)
        on conflict (id) do update set parts = excluded.parts
        where chat_messages.session_id = excluded.session_id`); // nunca pisar mensajes de otra sesión
  });
}

export async function clearMessages(db: Pick<DB, "execute">, sessionId: string): Promise<void> {
  await db.execute(sql`delete from chat_messages where session_id = ${sessionId}`);
}
