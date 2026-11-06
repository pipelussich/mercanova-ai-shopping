import { transcribeAudio } from "@/ai/transcribe";
import { hasAI } from "@/env";
import { createTranscribeHandler } from "./handler";

export const maxDuration = 60;

export const POST = createTranscribeHandler({ transcribe: transcribeAudio, enabled: hasAI });
