# MercaNova — AI Shopping Assistant

E-commerce de tecnología con un asistente de compras con IA (Google Gemini, free tier). Podés describir lo que necesitás por texto o por voz, recibir recomendaciones explicadas con datos reales del catálogo, comparar productos y completar una compra simulada que registra la orden y descuenta stock.

Obligatorio 2 · Sistemas de Soporte de Decisión · Universidad ORT Uruguay.

## Levantar la aplicación (Docker)

Requisitos: **Docker** con **Docker Compose v2** (Docker Desktop, OrbStack o colima).

```bash
git clone https://github.com/pipelussich/mercanova-ai-shopping.git
cd mercanova-ai-shopping
cp .env.example .env          # y completá GEMINI_API_KEY (ver abajo)
docker compose up --build
```

Abrí **http://localhost:3000**. El primer arranque compila la imagen, aplica las migraciones y carga el dataset de la cátedra (360 productos y sus embeddings precomputados), lo que lleva unos minutos. Los siguientes arranques reutilizan los datos.

### API key de Gemini (gratis)

1. Entrá a <https://aistudio.google.com/apikey> con una cuenta de Google.
2. Tocá **Create API key** y pegala en `.env` como `GEMINI_API_KEY=...`.

El free tier no requiere tarjeta. **Sin key la tienda funciona igual** (catálogo, carrito, checkout y órdenes): el asistente y la voz muestran un aviso, y la búsqueda usa palabras clave.

### Comandos útiles

| Acción | Comando |
|---|---|
| Levantar en segundo plano | `docker compose up --build -d` |
| Ver logs de la app | `docker compose logs -f app` |
| Usar otro puerto | `APP_PORT=8080 docker compose up --build` |
| Volver al estado inicial (borra órdenes y carritos) | `docker compose down -v && docker compose up --build` |
| Apagar | `docker compose down` |

## Qué incluye

- **Catálogo** con filtros, detalle con stock por depósito, productos relacionados y **comparador** de hasta 4 productos.
- **Búsqueda en lenguaje natural**: búsqueda semántica (embeddings `gemini-embedding-001` + pgvector) combinada con filtros estructurados, con respaldo por texto completo.
- **Asistente conversacional** (panel lateral en todas las páginas): entiende la necesidad, pide aclaraciones si falta información, recomienda y explica, compara, consulta stock y órdenes y modifica el carrito si se lo pedís. Usa sólo datos actuales de la base: precios y stock se muestran en tarjetas generadas desde los resultados de las herramientas.
- **Entrada por voz**: grabá tu consulta y se transcribe con Gemini.
- **Carrito**, **checkout** (envío o retiro en local), **confirmación explícita**, **compra simulada** con orden `MN-ORD-AAAAMMDD-NNNN`, descuento transaccional de stock por depósito e **historial de órdenes**.
- El asistente **no puede comprar**: la compra sólo se registra cuando confirmás en la pantalla de checkout.

## Arquitectura

```
src/domain   reglas de negocio puras (plata, stock, carrito, asignación a depósitos, checkout)
src/server   servicios y repositorios sobre PostgreSQL (Drizzle): catálogo, búsqueda, carrito, órdenes, chat
src/ai       Gemini: provider con reintentos y modelo de respaldo, embeddings, transcripción, tools y agente
src/app      páginas (Next.js App Router) y endpoints HTTP delgados
```

- **Stack:** Next.js 16 + TypeScript, PostgreSQL 17 + pgvector, Drizzle ORM, Vercel AI SDK 7 con `@ai-sdk/google` (Interactions API), Tailwind + shadcn/ui.
- **Modelos (todos gratuitos, configurables en `.env`):** chat `gemini-3.5-flash-lite` con respaldo `gemini-3.1-flash-lite`; embeddings `gemini-embedding-001` (768 dims); voz por el modelo multimodal con respaldo `gemini-3.5-transcribe`.
- Diseño completo y decisiones: [`docs/superpowers/specs/2026-11-06-mercanova-design.md`](docs/superpowers/specs/2026-11-06-mercanova-design.md). Plan de implementación: [`docs/superpowers/plans/2026-11-06-mercanova-implementation.md`](docs/superpowers/plans/2026-11-06-mercanova-implementation.md).

## Desarrollo local (sin Docker para la app)

Requisitos: Node.js 22+ y Docker para las bases.

```bash
npm ci
cp .env.example .env                                     # completar GEMINI_API_KEY
docker compose --profile test up -d --wait db db-test    # base de desarrollo (:5434) y de tests (:5433)
npm run db:migrate && npm run db:seed
npm run dev                                              # http://localhost:3000
```

### Tests

| Tipo | Comando | Qué cubre |
|---|---|---|
| Unitarios | `npm test` | dominio (plata, stock, carrito, asignación, checkout), provider con reintentos, manejo de errores de la API |
| Integración | `npm run test:integration` | servicios contra PostgreSQL real: catálogo, búsqueda, carrito, órdenes (incluye compras concurrentes y doble confirmación), tools y agente con modelo simulado, transcripción |
| E2E | `npm run test:e2e` | flujo completo en el navegador (Playwright) contra un build de producción |
| Evals del asistente | `npm run evals` | 7 casos con Gemini real; reporte en [`evals/last-report.md`](evals/last-report.md) |
| Todo lo rápido | `npm run check` | typecheck + lint + unitarios |

Los tests de integración y E2E usan la base efímera `db-test` (`docker compose --profile test up -d --wait db-test`). Para E2E instalá el navegador una vez con `npx playwright install chromium`.

### Otros scripts

- `npm run db:reset` — vuelve carritos, órdenes y stock al estado del dataset.
- `npm run embeddings:generate` — regenera `data/embeddings.json` (≈8 min por el límite del free tier).
- `npm run llm:smoke` — prueba rápida de conexión con Gemini (tool calling + streaming).

## Coding agent

El proyecto se desarrolló con Claude Code. Las reglas del proyecto están en [`AGENTS.md`](AGENTS.md) y las skills reutilizables en [`.claude/skills/`](.claude/skills): `testing`, `code-review` y `assistant-evals`.
