"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Mic, RotateCcw, SendHorizonal, Sparkles } from "lucide-react";
import { notifyCartChanged } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";
import { ToolResult } from "./tool-result-cards";
import { CART_TOOLS, type AssistantUIMessage } from "./types";
import { VoiceButton } from "./voice-button";

const EXAMPLES = [
  "Necesito unos auriculares cómodos para trabajar y hacer videollamadas. No quiero gastar más de USD 200. ¿Qué me recomendás?",
  "Busco un monitor para programar muchas horas",
  "¿Qué me conviene para mejorar el WiFi de casa?",
];

function errorText(err: Error | undefined): string | null {
  if (!err) return null;
  try {
    return JSON.parse(err.message)?.error?.message ?? err.message;
  } catch {
    return err.message || "Ocurrió un error con el asistente.";
  }
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, setMessages, status, error, clearError, stop } = useChat<AssistantUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // El historial vive en el servidor: sólo se envía el mensaje nuevo.
      prepareSendMessagesRequest: ({ messages }) => ({ body: { message: messages[messages.length - 1] } }),
    }),
    onFinish: ({ message }) => {
      if (message.parts.some((p) => CART_TOOLS.has(p.type.replace(/^tool-/, "")))) notifyCartChanged();
    },
  });

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data: { messages: AssistantUIMessage[]; enabled: boolean }) => {
        setMessages(data.messages ?? []);
        setEnabled(data.enabled);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [open, loaded, setMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string, voice = false) => {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    void sendMessage({ text: t, metadata: voice ? { voice: true } : undefined });
    setInput("");
  };

  const reset = async () => {
    stop();
    await fetch("/api/chat", { method: "DELETE" }).catch(() => {});
    setMessages([]);
    clearError();
  };

  return (
    <>
      <Button
        size="lg"
        className="fixed right-5 bottom-5 z-40 h-12 rounded-full px-5 shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente de compras"
      >
        <Sparkles /> Asistente
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="flex-row items-center gap-2 border-b pr-12">
            <SheetTitle className="flex items-center gap-2 whitespace-nowrap">
              <Bot className="size-5" /> Asistente de compras
            </SheetTitle>
            <Button variant="ghost" size="sm" className="mr-6 ml-auto" onClick={reset} disabled={messages.length === 0}>
              <RotateCcw /> Nueva conversación
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {!enabled && (
              <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                El asistente no está configurado en este entorno (falta GEMINI_API_KEY). Podés usar el catálogo, el
                carrito y la compra normalmente.
              </p>
            )}
            {messages.length === 0 && enabled && (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Contame qué necesitás con tus palabras (o por voz) y te ayudo a elegir. Uso sólo la información actual
                  del catálogo: precios y stock reales.
                </p>
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    onClick={() => send(e)}
                    className="rounded-lg border bg-background p-3 text-left hover:bg-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                  {m.parts.map((part, i) => {
                    if (part.type === "text")
                      return part.text.trim() ? (
                        <div
                          key={i}
                          className={cn(
                            "max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                            m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          {m.role === "user" && m.metadata?.voice && <Mic className="mr-1 inline size-3.5" />}
                          {m.role === "assistant" ? <RichText text={part.text} /> : part.text}
                        </div>
                      ) : null;
                    if (part.type.startsWith("tool-"))
                      return (
                        <div key={i} className="w-full">
                          <ToolResult part={part as Parameters<typeof ToolResult>[0]["part"]} />
                        </div>
                      );
                    return null;
                  })}
                </div>
              ))}
              {status === "submitted" && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Pensando…
                </p>
              )}
              {error && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  {errorText(error)}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={enabled ? "Escribí tu consulta…" : "Asistente no disponible"}
              disabled={!enabled}
              aria-label="Mensaje para el asistente"
              className="min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <VoiceButton disabled={!enabled || busy} onTranscript={(t) => send(t, true)} />
            <Button type="submit" size="icon-lg" disabled={!enabled || busy || !input.trim()} aria-label="Enviar">
              {busy ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
