"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toWav16kMono } from "./wav";

const MAX_SECONDS = 60;

type State = "idle" | "recording" | "transcribing";

/** Graba una consulta por voz, la transcribe en el servidor y la envía como mensaje de texto normal (RF-08). */
export function VoiceButton({ disabled, onTranscript }: { disabled?: boolean; onTranscript: (text: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Tu navegador no permite grabar audio. Escribí tu consulta.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Necesito permiso para usar el micrófono. Habilitalo en el navegador o escribí tu consulta.");
      return;
    }
    const chunks: Blob[] = [];
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const recording = new Blob(chunks, { type: rec.mimeType });
      if (recording.size === 0) {
        setState("idle");
        toast.error("No se grabó audio. Probá de nuevo.");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", await toWav16kMono(recording), "consulta.wav");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos transcribir el audio.");
        onTranscript(data.text);
      } catch (e) {
        toast.error((e as Error).message || "No pudimos procesar el audio. Escribí tu consulta.");
      } finally {
        setState("idle");
      }
    };
    rec.start();
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  };

  if (state === "recording")
    return (
      <Button
        type="button"
        size="icon-lg"
        variant="destructive"
        className="relative"
        onClick={stop}
        aria-label="Detener grabación"
      >
        <Square className="fill-current" />
        <span className="sr-only">{seconds}s</span>
        <span className="absolute -top-5 text-xs tabular-nums text-destructive">
          0:{String(seconds).padStart(2, "0")}
        </span>
      </Button>
    );
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="outline"
      className="relative"
      disabled={disabled || state === "transcribing"}
      onClick={start}
      aria-label={state === "transcribing" ? "Transcribiendo audio" : "Hablar"}
      title="Consultar por voz"
    >
      {state === "transcribing" ? <Loader2 className="animate-spin" /> : <Mic />}
    </Button>
  );
}
