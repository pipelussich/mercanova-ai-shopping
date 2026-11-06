---
name: assistant-evals
description: Use when changing the shopping assistant's system prompt, tool descriptions, tool outputs or agent loop in MercaNova, or when the assistant hallucinates, skips a clarification, or ignores a budget — explains how to add an eval case, run the eval suite within Gemini free-tier quota and diagnose failures. Triggers on "el asistente inventó", "agregá un eval", "corré los evals", "cambié el prompt".
---

# Evals del asistente

Los evals ejecutan el agente real (Gemini free tier) contra la base de test y verifican comportamiento, no texto exacto. Son la evidencia de RF-04, RF-05, RF-07 y RF-18.

## Correr

```bash
docker compose --profile test up -d --wait db-test
npm run evals
```

- Corre secuencialmente con pausa entre casos para respetar la cuota (~10 pedidos/min). Cada caso usa varios pedidos (un paso por tool).
- Resultado en `evals/last-report.md` (se versiona como evidencia). Si cambiaste el prompt o las tools, commiteá el reporte nuevo.
- Si aparece `AI_UNAVAILABLE` / 429 en varios casos, es cuota, no un bug: esperá un minuto y reintentá.

## Agregar un caso

En `evals/cases.ts`:

```ts
{
  id: "kebab-case-descriptivo",
  turns: ["mensaje del usuario", "segundo turno opcional"],
  expect: {
    toolsCalled: ["search_products"],      // tools que tienen que aparecer
    toolsNotCalled: ["add_to_cart"],       // tools que no deben usarse
    askClarification: true,                // termina preguntando y no busca a ciegas
    maxPriceUsd: 200,                      // nada recomendado por encima del presupuesto
    mustNotMatch: [/US\$\s?\d/],           // texto prohibido (p.ej. precios de algo inexistente)
    pricesMustMatchDb: true,               // todo monto citado coincide con un priceUsd de una tool
  },
}
```

Un caso por comportamiento. Preferí checks estructurales (tools llamadas, montos contra la DB) a buscar palabras exactas.

## Diagnosticar una falla

1. Abrí `evals/last-report.md` y mirá, para el caso, la secuencia de tool calls y sus argumentos.
2. Clasificá:
   - **No llamó la tool correcta** → mejorar la `description` de la tool (en inglés, qué hace y cuándo usarla) antes que el prompt.
   - **Llamó bien pero afirmó algo que no estaba en el resultado** → reforzar la regla de grounding en `src/ai/system-prompt.ts` y revisar si la tool devuelve el dato con un nombre claro (`priceUsd`, `availableQty`).
   - **No pidió aclaración** → revisar el criterio de "información decisiva" del prompt.
   - **Error de tool** → es un bug del servicio: escribir un test de integración que lo reproduzca (skill `testing`).
3. Cambiá una cosa por vez y volvé a correr sólo ese caso (`npx vitest run --project evals -t "<id>"`).

Nunca "arregles" un eval relajando su expectativa sin explicar el porqué en el reporte.
