# MercaNova — AI Shopping Assistant · Documento de diseño

Fecha: 2026-11-06 · Obligatorio 2, Sistemas de Soporte de Decisión (ORT) · Equipo: Felipe Lussich, Mateo Falco (283972)
Fuente de verdad de requisitos: `Obligatorio_2_AI.pdf` (RF-01..RF-18, RNF-01..RNF-07, §10 Coding Agents). Este documento decide el *cómo*.

## 1. Intención

Construir un e-commerce ficticio (tecnología/electrónica) donde un usuario describe lo que necesita en lenguaje natural —por texto o voz—, un asistente lo ayuda a encontrar, entender y comparar productos usando **sólo datos reales del sistema**, y el usuario completa una compra simulada que deja una orden persistida y el stock actualizado.

La rúbrica premia: flujo end-to-end completo (4), asistente de calidad que no inventa y pide aclaraciones (4), arquitectura coherente y justificada (3). Por eso la regla rectora es: **simple, completo y defendible > sofisticado**. Cada componente debe poder justificarse con Problema / Alternativas / Decisión / Justificación / Trade-offs.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**: cumplir los 18 RF y 7 RNF; `docker compose up` levanta todo desde un clone limpio con sólo una `GEMINI_API_KEY` gratuita; tests que pasan; AGENTS.md + ≥2 skills.

**No-objetivos** (fuera de alcance por letra §13): login/autenticación, pagos reales, deploy cloud, multi-agent, MCP, síntesis de voz, diseño comercial. PDF y video: se hacen después, no en este plan.

**Anti-objetivos** (aunque "funcione", sería un fracaso):
- El asistente afirma un precio, stock o spec que no salió de la base de datos (RF-07, RF-18).
- El asistente puede completar una compra sin confirmación explícita del usuario en la UI (RF-12).
- Una compra deja stock negativo o inconsistente, o dos compras concurrentes venden la misma unidad (RF-10, RF-15, RNF-04).
- Cualquier costo de IA: **todo debe funcionar en el free tier de Gemini**. Nada de modelos pagos.
- Un chat que es un único prompt genérico pegado a un frontend (§7 IMPORTANTE).

## 3. Restricciones

- Costo cero de IA → Google Gemini API free tier (key gratuita de AI Studio). Límites aprox.: ~10 RPM / ~1.500 RPD en modelos 3.x Flash; varían por key. El diseño debe minimizar llamadas y degradar bien ante 429.
- Todo en español (UI y asistente). El dataset está en inglés: los datos se muestran tal cual (no se traducen nombres/specs en la base); el asistente responde en español citando los datos.
- Sin login: un visitante anónimo identificado por cookie de sesión.
- Un solo repo privado en GitHub (`gh` de pipelussich), commits directos a `main`. Docentes se invitan como colaboradores al entregar.
- Docker obligatorio (docker compose).

## 4. Dataset (insumo de la cátedra)

`MercaNova_dataset_obligatorio_2.xlsx`, 8 hojas, limpio (sin IDs duplicados, sin relaciones huérfanas, `available = on_hand − reserved` consistente):

| Hoja | Filas | Notas |
|---|---|---|
| Products | 360 | 12 categorías × 30. 17 con `active=false`. Campos: descripción, recommended_for / not_recommended_for, key_features, tags, rating, garantía, devolución, image_url (placehold.co) |
| Specifications | 3.000 | EAV: group, name, value_text / value_number, unit |
| Pricing | 360 | USD, list_price, current_price, discount_percent |
| Inventory | 1.800 | 5 depósitos × 360. 22 productos con 0 disponible total |
| Warehouses | 5 | Montevideo ×2, Canelones, Maldonado, Colonia; pickup y envío habilitados |
| Relations | 1.080 | alternative_to, accessory_for, often_bought_with + strength |
| Categories, Brands | 37, 20 | jerarquía categoría/subcategoría; marca con positioning |

El xlsx se versiona en `data/` (repo privado) y se importa con un script de seed idempotente.

## 5. Decisiones tomadas

### 5.1 Stack — una sola app Next.js full-stack (decisión de Felipe: "monorepo nextjs")
- **Next.js (App Router) + TypeScript**, un único repo y una única app. Las route handlers / server actions son el backend; no hay un servicio separado.
- Capas internas estrictas para que "separación de responsabilidades" sea defendible:
  - `src/domain/` — lógica de negocio pura (carrito, asignación de stock, validaciones, cálculo de totales). Sin Next ni SDKs.
  - `src/server/` — repositorios (acceso a DB) y servicios que orquestan dominio + DB en transacciones.
  - `src/ai/` — integración con el LLM: definición de tools, prompt de sistema, búsqueda semántica, transcripción.
  - `src/app/` — UI y endpoints HTTP, delgados: validan input (zod) y llaman servicios.
- **PostgreSQL 17 + pgvector** en Docker. ORM: **Drizzle** (schema en TS, migraciones SQL versionadas).
- **Vercel AI SDK** con provider `@ai-sdk/google`: tool calling multi-paso, streaming al frontend y renderizado de resultados de tools como componentes.
- UI: Tailwind + shadcn/ui. Tests: Vitest + Playwright.

### 5.2 LLM — Gemini free tier
- Modelo de chat configurable por env (`GEMINI_CHAT_MODEL`), default: el Flash 3.x gratuito vigente al implementar (verificar con la key real). Fallback configurable a un Flash-Lite ante 429.
- Embeddings: `gemini-embedding-001` (gratuito, multilingüe: consulta en español ↔ productos en inglés).
- Voz: el mismo modelo Gemini transcribe audio (input multimodal) → gratis, funciona en cualquier browser.

### 5.3 Búsqueda (RF-02) — híbrida
- Cada producto activo tiene un "documento de búsqueda" (nombre, marca, categoría, descripción, recommended_for, key_features, tags, specs clave) y su embedding en pgvector.
- **Embeddings precomputados y versionados** en `data/embeddings.json` (generados una vez con un script). El seed los carga sin llamar a la API → el seed es reproducible, rápido y no consume cuota del docente. Script `npm run embeddings:generate` para regenerar.
- Query: el LLM llama a la tool `search_products` con `query` libre + filtros estructurados opcionales (categoría, precio máx/mín, marca, sólo con stock). El servidor embebe la query (1 llamada), aplica filtros en SQL y ordena por similitud coseno. Fallback si falla el embedding: Postgres full-text search.
- La búsqueda del catálogo (sin chat) usa el mismo servicio, así RF-02 existe también fuera del asistente.

### 5.4 Asistente (RF-03..07, RF-17, RF-18) — un agente con tools, sin multi-agent
- Un solo agente (AI SDK `streamText` con tools y `stopWhen: stepCountIs(N)`, N≈5) que decide en varios pasos qué tools usar.
- **Tools de lectura**: `search_products`, `get_product_details` (incluye specs, precio actual, stock por depósito), `compare_products` (2–4 ids → tabla de specs comunes alineadas), `get_related_products` (alternativas/accesorios desde Relations), `get_cart`, `get_orders`.
- **Tools de escritura acotadas**: `add_to_cart`, `update_cart_item`, `remove_from_cart` (validan stock en el servidor). Se ejecutan sólo cuando el usuario lo pide explícitamente en el chat (regla del prompt), son reversibles y cada una se muestra en el chat como una tarjeta con el cambio y un botón "Deshacer". No piden aprobación previa porque no son irreversibles; la única acción irreversible (la compra) no está disponible para el modelo. Esto es el "tratamiento controlado" de §8. *(Decisión de Claude.)* **No existe tool de compra.** El asistente puede ofrecer "ir al checkout" (tool `propose_checkout` que sólo devuelve un link/botón); la orden sólo se crea desde la UI de checkout tras confirmación explícita (RF-12, §8).
- **Grounding (RF-07/18)**: precios, stock y specs que ve el usuario se renderizan desde el *output de las tools* (tarjetas de producto, tabla comparativa, carrito) — datos de la DB al momento de la consulta, no texto generado. El prompt de sistema prohíbe afirmar precio/stock/specs sin haberlos obtenido de una tool en ese turno y obliga a decir "no tengo esa información" cuando un dato no existe. Tests de evaluación verifican esto.
- **Aclaraciones (RF-05)**: el prompt instruye a preguntar (máx. 1–2 preguntas concretas) cuando falta algo decisivo (categoría, uso, presupuesto) en vez de buscar a ciegas; la UI muestra sugerencias rápidas como chips.
- **Recomendaciones explicadas (RF-04)**: la tool de búsqueda devuelve `recommended_for` / `not_recommended_for` / features para que la explicación se apoye en datos; el asistente recomienda 1–3 opciones con el porqué.
- **Estado**: la conversación se persiste por sesión en la DB (tabla `chat_messages`). El carrito es estado de la app, no del modelo: el modelo lo lee vía tools.
- **Productos inactivos** (17) *se muestran* en el catálogo (RF-01 pide mostrar el dataset) con badge "Discontinuado", pero no se pueden agregar al carrito, el filtro por defecto del catálogo los oculta (toggle para verlos), y la búsqueda del asistente los excluye salvo que el usuario pregunte por uno puntual. *(Decisión de Claude.)*
- Los productos **sin stock** se muestran como agotados y el asistente propone alternativas (Relations `alternative_to`).
- **Robustez ante el free tier**: reintento con backoff ante 429/5xx, fallback de modelo, y si aun así falla, mensaje claro en el chat ("el asistente está saturado, probá en unos segundos") sin romper la app. El resto de la tienda funciona sin IA.

### 5.5 Voz (RF-08)
Botón de micrófono en el chat → `MediaRecorder` graba → `POST /api/transcribe` (audio ≤ ~60 s) → Gemini transcribe → el texto aparece en el input y se envía como consulta normal (el usuario puede ver/editar antes). Errores: permiso denegado, audio vacío, transcripción vacía → mensaje claro.

### 5.6 Carrito, stock y compra (RF-09..16)
- Sesión anónima: cookie `session_id` (httpOnly) creada en el primer request. Carrito y órdenes cuelgan de la sesión. "Mis órdenes" = órdenes de esa sesión.
- **Disponibilidad** de un producto = suma de `available_qty` de sus depósitos.
- Carrito: agregar / quitar / cambiar cantidad, total recalculado siempre con el **precio actual** de la DB. No se puede agregar más que lo disponible (RF-10); si el stock bajó después de agregar, el carrito lo marca y el checkout lo bloquea con mensaje.
- **Checkout** (RF-11): nombre, email, teléfono, método de entrega (envío a domicilio con dirección + departamento, o retiro en un depósito). Pago: siempre "simulado", sin datos de tarjeta (RF-13).
- **Confirmación** (RF-12): pantalla de revisión con ítems, precios actuales, total y entrega → botón "Confirmar compra". Sólo ese POST crea la orden.
- **Registro de la orden** (RF-14, RF-15) en una transacción con `SELECT … FOR UPDATE` sobre inventario: re-valida stock y precio, asigna unidades a depósitos (retiro: debe salir del depósito elegido; envío: greedy desde el depósito con más stock), descuenta `on_hand_qty`/`available_qty`, recalcula `inventory_status`, guarda la orden con snapshot de precios y asignación, vacía el carrito. Idempotencia por `idempotency_key` para evitar doble compra por doble click. ID de orden legible: `MN-ORD-YYYYMMDD-XXXX`.
- **Historial** (RF-16): lista y detalle de órdenes de la sesión; también consultable desde el chat.

### 5.7 Modelo de datos (Drizzle / Postgres)
`brands`, `categories`, `products` (+ `active`), `product_specs` (EAV), `prices`, `warehouses`, `inventory` (product × warehouse), `product_relations`, `product_embeddings` (vector), `sessions`, `cart_items`, `orders`, `order_items`, `order_allocations` (item × warehouse × qty), `chat_messages`. El catálogo viene del seed; carrito/órdenes/inventario son el estado operacional. Reset: `npm run db:reset` vuelve al estado del dataset.

### 5.8 Frontend (§5)
Pantallas: Catálogo (grilla + búsqueda en lenguaje natural + filtros por categoría/precio/stock), Detalle de producto (specs, stock por depósito, relacionados), Comparador (hasta 4), Carrito, Checkout → Revisión/Confirmación → Orden confirmada, Mis órdenes. El **asistente es un panel lateral persistente** disponible en todas las pantallas, con tarjetas de producto accionables (ver, agregar al carrito, comparar) dentro del chat, para integrar conversación y flujo de compra (criterio de 2 pts de frontend).

### 5.9 Testing (RNF-05)
- Unit (Vitest): dominio — totales, validación de cantidades, asignación de stock a depósitos, transiciones de checkout.
- Integración (Vitest + Postgres en Docker): servicios de carrito y orden contra DB real, incluida concurrencia (dos compras simultáneas del último ítem → una falla limpia), seed/import.
- Tools del asistente (Vitest): cada tool contra DB real; el loop del agente con un modelo mock del AI SDK (verifica que la compra no es posible vía tools y que los errores de tool se manejan).
- Evals del asistente (opt-in, usan Gemini real, `npm run evals`): set chico de casos (consulta ambigua → pide aclaración; presupuesto → no recomienda por encima; producto inexistente → no inventa; producto agotado → ofrece alternativa; precio en el texto coincide con la DB). Opt-in por cuota del free tier.
- E2E (Playwright): catálogo → carrito → checkout → confirmación → orden → stock descontado.

### 5.10 Docker y configuración (RNF-01..03, RNF-07)
`docker compose up --build` levanta `db` (pgvector) y `app`; al iniciar, `app` corre migraciones y seed si la DB está vacía. `.env.example` documenta `GEMINI_API_KEY`, modelos y `DATABASE_URL`. `.env` en `.gitignore`. Sin la key, la tienda funciona y el chat/voz muestran un aviso claro.

### 5.11 Coding agent (§10)
`AGENTS.md` en la raíz (arquitectura en capas, comandos, convenciones, reglas: nunca agregar tool de compra, todo dato de producto viene de la DB, tests antes de commit, no versionar secretos) con `CLAUDE.md` apuntando a él. Skills versionadas en `.claude/skills/`: `testing` (cómo escribir y correr cada tipo de test), `code-review` (checklist de revisión contra RF/RNF y anti-objetivos), `assistant-evals` (cómo agregar/correr evals y diagnosticar alucinaciones).

## 6. Fases

0. **Base**: repo privado, Next + TS + Tailwind, docker compose con Postgres/pgvector, schema Drizzle, seed desde el xlsx, embeddings precomputados, AGENTS.md + skills, CI local (`npm run check`).
1. **Catálogo** (RF-01): listado, filtros, detalle, relacionados, comparador manual.
2. **Compra** (RF-09..16): sesión, carrito, checkout, confirmación, orden transaccional, historial. Tests de dominio + integración + concurrencia.
3. **Búsqueda** (RF-02): servicio híbrido + búsqueda en lenguaje natural en el catálogo.
4. **Asistente** (RF-03..07, 17, 18): tools, prompt, multi-paso, UI del chat con tarjetas, persistencia, manejo de 429.
5. **Voz** (RF-08).
6. **Robustez y cierre**: casos límite, evals, E2E, prueba desde clone limpio con Docker, README.
(Después, fuera de este plan: PDF y video.)

## 7. Decisiones de ejecución
- Todo el código lo escribe Claude; un solo flujo secuencial por fases, commits directos a `main`. Defensa y reparto con Mateo: no condicionan el plan (indicación de Felipe).
- Repo: `pipelussich/mercanova-ai-shopping` (privado), clonado en `~/mercanova-ai-shopping`. *(Decisión de Claude.)*
- Docker: colima instalado vía brew en la Mac de Felipe (Docker 29.5, compose 5.7). Imagen DB: `pgvector/pgvector:pg17` (Postgres 17).

## 8. Queda a criterio del builder
Estructura exacta de carpetas, componentes de UI, textos del prompt, tamaño de página, estilo visual (claro y consistente, no comercial), nombres de endpoints, detalle del set de evals.

## 9. Riesgos
- **Cuota del free tier** durante desarrollo, evals y demo → embeddings precomputados, N de pasos acotado, fallback de modelo, evals opt-in.
- **Docker no está instalado en la máquina de Felipe** → necesario para verificar RNF-02 y para los tests de integración.
- Modelo free disponible cambia → nombre de modelo por env.
