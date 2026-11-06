---
name: testing
description: Use when writing, running or fixing tests in MercaNova — decides which test layer a change needs (unit, integration, e2e, evals), how to set up the test database, and which commands prove the change works. Triggers on "agregá tests", "corré los tests", "por qué falla este test", any new feature or bugfix.
---

# Testing en MercaNova

Regla base: **TDD**. Escribí el test, miralo fallar por el motivo correcto, implementá lo mínimo, miralo pasar, corré la suite.

## ¿Qué capa de test corresponde?

| Si el cambio toca… | Test | Dónde | Comando |
|---|---|---|---|
| Lógica pura (`src/domain/*`): plata, stock, asignación, validaciones | Unit | `tests/unit/*.test.ts` | `npm test` |
| Servicios con DB (`src/server/*`), tools del asistente, route handlers | Integration (Postgres real) | `tests/integration/*.test.ts` | `npm run test:integration` |
| Flujo de usuario en el browser (catálogo → compra → órdenes) | E2E (Playwright) | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Prompt, descripciones de tools o comportamiento del asistente | Evals (Gemini real) | `evals/` | ver skill `assistant-evals` |

No mockees la base de datos: los tests de integración usan `db-test` (Postgres efímero en tmpfs). Mockeá sólo lo externo y no determinístico: Gemini (`ai/test` mock model, `embedQuery` fake inyectado) y el reloj si hace falta.

## Preparar el entorno

```bash
docker compose --profile test up -d --wait db-test
```

- El `globalSetup` de integración (`tests/integration/global-setup.ts`) migra y carga el dataset completo una vez.
- `tests/integration/setup-env.ts` fuerza `DATABASE_URL` a la base de test: un test nunca toca la base de desarrollo.
- Los tests que modifican estado operacional llaman `resetOperationalState(db, DATASET_PATH)` en `beforeEach` (borra carritos/órdenes/chats y restaura el inventario del dataset).
- Para crear una sesión en tests: insertar un UUID en `sessions` y pasarlo a los servicios (los servicios reciben `sessionId`, no leen cookies).
- Leé valores esperados del dataset (`readWorkbook(DATASET_PATH)`) en vez de hardcodear números que no estén en el spec.

## Qué tiene que tener un buen test acá

- Nombre en español que describe el comportamiento ("rechaza agregar más que el stock disponible").
- Afirmaciones sobre el resultado observable (DB, respuesta HTTP, texto en pantalla), no sobre llamadas a mocks.
- Casos límite de la letra (RF-17): producto inexistente, inactivo, sin stock, cantidades inválidas, concurrencia en la compra, IA caída.

## Antes de commitear

```bash
npm run check              # typecheck + lint + unit → tiene que salir con código 0
npm run test:integration   # si tocaste src/server, src/ai o rutas
```

Si un test falla y no es por tu cambio, decilo explícitamente en el reporte; no lo saltees ni lo marques `.skip`.
