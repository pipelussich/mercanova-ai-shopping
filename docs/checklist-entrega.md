# Checklist previo a la entrega (§16 de la letra) — evidencia

Estado al 2026-11-15. Cada ítem indica dónde está la prueba (test automatizado, comando o pantalla).

| Ítem de la letra | Estado | Evidencia |
|---|---|---|
| La aplicación puede levantarse localmente con las instrucciones entregadas | ✅ | Prueba desde clone limpio: `gh repo clone` → `cp .env.example .env` → `docker compose up --build`: contenedores sanos, migraciones + dataset + 360 embeddings cargados, app en http://localhost:3000. Instrucciones en `README.md`. |
| El frontend permite completar el flujo principal | ✅ | `tests/e2e/purchase.spec.ts` › "compra completa: carrito → checkout → confirmación → orden → stock descontado" (Playwright, build de producción). |
| La consulta por texto funciona | ✅ | Panel "Asistente" en todas las páginas. Evals con Gemini real: `evals/last-report.md` (7/7). Tests del agente: `tests/integration/agent.test.ts`. |
| La entrada por voz funciona | ✅ | Botón de micrófono en el panel → `POST /api/transcribe` → la transcripción se envía como consulta normal. `tests/integration/transcribe-route.test.ts` (7 casos de error y éxito) y verificación manual: audio de prueba → "Necesito unos auriculares cómodos para trabajar, no quiero gastar más de 200 dólares." → búsqueda ≤ US$ 200. |
| El asistente utiliza información real de la aplicación y no inventa datos críticos | ✅ | Tarjetas, tablas y totales del chat se renderizan desde los resultados de las tools (DB). Evals `headphones-budget`, `nonexistent-product`, `out-of-stock`, `compare` verifican que todo monto citado coincide con la DB. Prompt: `src/ai/system-prompt.ts`. |
| El usuario puede agregar productos al carrito y modificarlo | ✅ | `tests/integration/cart.test.ts` (10 casos) · E2E "no permite superar el stock disponible" · pantalla `/carrito` con +/−/cantidad/quitar · desde el chat con "Deshacer". |
| El checkout funciona y requiere confirmación antes de completar la compra | ✅ | `/checkout` (datos) → `/checkout/confirmar` (revisión + botón "Confirmar compra"). La única vía para crear órdenes es `POST /api/orders`; el asistente no tiene ninguna tool de compra (`tests/integration/tools.test.ts`, `agent.test.ts` › "no puede registrar compras aunque el modelo lo intente", eval `no-purchase`). |
| La compra ficticia genera una orden persistida | ✅ | `tests/integration/orders.test.ts` › id `MN-ORD-AAAAMMDD-NNNN`, ítems con snapshot de precio, asignación por depósito; tabla `orders`. |
| El estado de disponibilidad queda coherente luego de una compra | ✅ | `orders.test.ts`: descuento exacto por depósito, estado recalculado, compras concurrentes de la última unidad (una sola gana, nunca stock negativo), doble click con la misma clave (una sola orden), precio cambiado → no se escribe nada. E2E: disponibilidad mostrada baja en 2. |
| Las órdenes pueden consultarse | ✅ | `/ordenes` y `/ordenes/[id]`; `orders.test.ts` › "historial"; tool `get_orders`. |
| Los casos límite principales están manejados | ✅ | Producto inexistente/discontinuado/sin stock, cantidades inválidas, carrito vacío, precio cambiado, retiro sin stock, IA sin key o saturada (fallback de modelo + mensaje), audio vacío/grande/formato, base caída (`error.tsx` con "Reintentar"). Tests: `tests/unit/api-errors.test.ts`, `cart.test.ts`, `orders.test.ts`, `agent.test.ts`, `transcribe-route.test.ts`. |
| Los tests definidos por el equipo pasan | ✅ | `npm run check` (typecheck + lint + unitarios) · `npm run test:integration` · `npm run test:e2e` · `npm run evals`. |
| Docker y las variables de entorno están documentados | ✅ | `README.md`, `.env.example` (comentado), `docker-compose.yml`, `Dockerfile`. |
| El repositorio contiene AGENTS.md y al menos dos Skills | ✅ | `AGENTS.md` (+ `CLAUDE.md` que lo importa) y `.claude/skills/{testing,code-review,assistant-evals}/SKILL.md`. |
| El PDF contiene arquitectura, secuencias, decisiones, capturas, repositorios y video | ⏳ | `docs/entrega/MercaNova-documento-tecnico.pdf` completo; falta poner el grupo y el link del video en la portada y en la sección 14. |
| Los links compartidos son accesibles por los docentes | ⏳ | Repo privado: invitar a los docentes como colaboradores al entregar (`gh repo edit` / Settings → Collaborators). |
| El video muestra el flujo end-to-end en aproximadamente 5 minutos | ⏳ | Pendiente (etapa siguiente). |

## Cobertura de requisitos funcionales

| RF | Implementación | Prueba |
|---|---|---|
| RF-01 Catálogo | `src/app/page.tsx`, `src/server/catalog/*` | `catalog.test.ts` |
| RF-02 Búsqueda en lenguaje natural | `src/ai/query-understanding.ts` (structured output) + `src/server/search/search-service.ts` (pgvector + filtros + fallback) | `query-understanding.test.ts`, `search.test.ts`, `evals/query-understanding.eval.ts` |
| RF-03 Asistente | `src/ai/agent.ts`, `src/components/assistant/*` | `agent.test.ts`, evals |
| RF-04 Recomendaciones explicadas | prompt + `recommendedFor/keyFeatures/matchReasons` en `search_products` | eval `headphones-budget` |
| RF-05 Aclaraciones | prompt | eval `ambiguous` |
| RF-06 Comparación | `compareProducts`, `/comparar`, tool `compare_products` | `catalog.test.ts`, eval `compare` |
| RF-07 Información actual | tools leen la DB en cada llamada; UI desde tool outputs | `tools.test.ts`, evals |
| RF-08 Voz | `voice-button.tsx`, `/api/transcribe`, `src/ai/transcribe.ts` | `transcribe-route.test.ts`, `wav.test.ts` |
| RF-09 Carrito | `cart-service.ts`, `/carrito` | `cart.test.ts`, E2E |
| RF-10 Validación de disponibilidad | `validateQuantity`, `placeOrder` con `FOR UPDATE` | `cart.test.ts`, `orders.test.ts`, E2E |
| RF-11 Checkout | `checkoutSchema`, `/checkout` | `checkout.test.ts`, E2E |
| RF-12 Confirmación | `/checkout/confirmar`, sin tool de compra | `orders.test.ts`, `agent.test.ts`, eval `no-purchase` |
| RF-13 Compra ficticia | sin datos de tarjeta | E2E |
| RF-14 Orden | `orders`, `order_items`, `order_allocations` | `orders.test.ts` |
| RF-15 Actualización de estado | descuento por depósito + estado recalculado | `orders.test.ts`, E2E |
| RF-16 Historial | `/ordenes` | `orders.test.ts` |
| RF-17 Casos límite | `DomainError` + `handleRoute` + `error.tsx` + fallbacks de IA | ver arriba |
| RF-18 No invención | grounding por tools + evals de montos | evals |
