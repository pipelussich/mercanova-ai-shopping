<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MercaNova — AI Shopping Assistant

E-commerce ficticio (obligatorio de Sistemas de Soporte de Decisión, ORT) donde un asistente con Gemini ayuda a encontrar, comparar y comprar productos de tecnología. Compra simulada: sin pagos reales.

- **Spec (fuente de verdad del diseño):** `docs/superpowers/specs/2026-11-06-mercanova-design.md`
- **Plan de implementación:** `docs/superpowers/plans/2026-11-06-mercanova-implementation.md`
- **Letra del obligatorio:** RF-01..RF-18 y RNF-01..RNF-07 (resumidos en el spec).

## Arquitectura en capas

| Capa | Carpeta | Responsabilidad | Puede importar |
|---|---|---|---|
| Dominio | `src/domain/` | Reglas puras: plata, stock, carrito, asignación a depósitos, validación de checkout, errores | nada del proyecto (sólo zod) |
| Servidor | `src/server/` | Repositorios y servicios transaccionales sobre Postgres (Drizzle) | `domain`, `db` |
| IA | `src/ai/` | Provider Gemini (retry/fallback), embeddings, transcripción, tools, agente, prompt | `domain`, `server`, `db` |
| App | `src/app/`, `src/components/` | UI y endpoints HTTP delgados (validan input y llaman servicios) | `domain`, `server`, `ai` (nunca `db/schema` directo) |
| Datos | `src/db/` | Schema, cliente, migraciones | — |

## Comandos

```bash
docker compose --profile test up -d --wait db db-test   # bases de dev (:5434) y test (:5433)
npm run db:migrate && npm run db:seed                    # migrar y cargar el dataset
npm run dev                                              # app en http://localhost:3000
npm run check                                            # typecheck + lint + unit (obligatorio antes de commit)
npm run test:integration                                 # contra db-test
npm run test:e2e                                         # Playwright (flujo de compra)
npm run evals                                            # evals del asistente (usa Gemini real, consume cuota)
npm run db:reset                                         # vuelve carrito/órdenes/stock al estado del dataset
```

## Reglas duras (no negociables)

1. **El modelo nunca compra.** No existe ni debe existir una tool que cree órdenes. Sólo `POST /api/orders`, desde la pantalla de confirmación, crea una orden (RF-12).
2. **Ningún dato de producto inventado.** Precio, stock, specs, garantía y órdenes que ve el usuario salen de la DB en el momento de la consulta (RF-07, RF-18). La UI renderiza esos datos desde los resultados de las tools, no desde texto generado.
3. **Plata en centavos enteros** en TypeScript; `numeric(10,2)` en DB. Formato `Intl.NumberFormat('es-UY', { style: 'currency', currency: 'USD' })`.
4. **Disponibilidad** = suma de `available_qty` por depósito. Estado por fila: 0 → `Out of stock`, 1–2 → `Low stock`, ≥3 → `In stock`.
5. **Cambios de stock sólo dentro de una transacción** con `SELECT … FOR UPDATE` (ver `placeOrder`). Nunca stock negativo.
6. **Costo de IA cero:** sólo modelos del free tier de Gemini, configurados por env. No agregar proveedores pagos.
7. **Secretos sólo en `.env`** (gitignored). Nunca escribir keys en código, tests, logs ni commits.
8. **Todo en español** (UI, mensajes de error, respuestas del asistente). Los datos del dataset quedan en inglés.
9. **Errores previsibles no rompen la app** (RNF-04): errores de dominio → `DomainError` con mensaje en español; la tienda funciona aunque Gemini falle o no haya key.

## Cómo trabajar

- **TDD:** test que falla → implementación mínima → test verde. Ver skill `testing`.
- Antes de cada commit: `npm run check` en verde. Un commit por tarea del plan, mensaje en español con prefijo convencional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Para revisar cambios usar la skill `code-review`; para tocar el prompt o las tools del asistente, la skill `assistant-evals`.
- Next 16 tiene `cacheComponents` activado: todo acceso a DB, `cookies()` o `searchParams` en Server Components va dentro de `<Suspense>`. Leer `node_modules/next/dist/docs/` ante la duda.
