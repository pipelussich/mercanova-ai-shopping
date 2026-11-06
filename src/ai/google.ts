import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { getEnv } from "../env";

export class AIDisabledError extends Error {
  constructor() {
    super("El asistente no está configurado (falta GEMINI_API_KEY). La tienda funciona normalmente.");
    this.name = "AIDisabledError";
  }
}

let cached: GoogleGenerativeAIProvider | undefined;

/** Provider de Gemini (free tier) con la key de GEMINI_API_KEY. */
export function getGoogle(): GoogleGenerativeAIProvider {
  const { GEMINI_API_KEY } = getEnv();
  if (!GEMINI_API_KEY) throw new AIDisabledError();
  cached ??= createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });
  return cached;
}
