# MercaNova AI Shopping Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un e-commerce ficticio en Next.js donde un asistente con Gemini (free tier) ayuda a encontrar, comparar y agregar productos al carrito usando sólo datos de la DB, y el usuario completa una compra simulada que persiste la orden y descuenta stock.

**Architecture:** Una sola app Next.js (App Router) con capas `src/domain` (lógica pura), `src/server` (repositorios + servicios transaccionales sobre Postgres/Drizzle), `src/ai` (tools, agente, búsqueda semántica, transcripción) y `src/app` (UI + endpoints delgados). Postgres 17 + pgvector en Docker; `docker compose up --build` corre migraciones + seed y levanta la app.

**Tech Stack:** Node 24, Next 16.4, React 19, TypeScript, Tailwind 4 + shadcn/ui, Drizzle ORM 0.45 + drizzle-kit 0.31 + `postgres` 4 (driver), pgvector, `ai` 7 + `@ai-sdk/google` 4 + `@ai-sdk/react` 4, Zod 4, `exceljs` (lectura del xlsx), Vitest 5, Playwright 1.65.

**Spec:** `docs/superpowers/specs/2026-11-06-mercanova-design.md` (diseño aprobado). Letra: `~/Downloads/Obligatorio_2_AI.pdf` (RF-01..18, RNF-01..07). Leer ambos.

## Global Constraints

- Costo de IA cero: sólo Gemini free tier. Chat por `google.interactions(model)`; default `gemini-3.5-flash-lite`, fallback `gemini-3.1-flash-lite`; embeddings `gemini-embedding-001` a 768 dims; transcripción `gemini-3.5-transcribe`. Todos configurables por env.
- Toda la UI y toda respuesta del asistente en español rioplatense ("vos"). Datos del dataset (nombres, descripciones, specs) se muestran tal cual, en inglés.
- Plata: en DB `numeric(10,2)`; en TS siempre **centavos enteros** (`number`). Formato: `new Intl.NumberFormat('es-UY',{style:'currency',currency:'USD'})`.
- Disponibilidad de un producto = suma de `available_qty` de sus filas de `inventory`. Estado por fila: `0 → 'Out of stock'`, `1–2 → 'Low stock'`, `≥3 → 'In stock'` (umbral del dataset).
- Productos `active=false`: visibles con badge "Discontinuado", nunca comprables, excluidos de la búsqueda por defecto.
- El modelo **no tiene ninguna tool que cree órdenes**. Sólo `POST /api/orders` desde la pantalla de confirmación crea una orden.
- Precio/stock/specs mostrados al usuario salen de la DB en el momento de la consulta.
- Secretos sólo en `.env` (gitignored). `.env.example` versionado. Nunca escribir la key en archivos versionados ni en logs.
- Sin login: cookie httpOnly `mn_session` (UUID v4), creada en el primer request.
- Commits directos a `main` (pedido de Felipe), mensajes en español con prefijo convencional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git push origin main` después de cada tarea.
- Antes de cada commit: `npm run check` (typecheck + lint + unit tests) en verde.

## Review Focus

1. **Doble click / reintento en "Confirmar compra"** → una sola orden, stock descontado una vez (idempotency key). Test en Task 7.
2. **Stock que cambia entre agregar al carrito y confirmar** (otra compra se lleva las unidades) → la confirmación falla con mensaje claro, sin orden parcial ni stock negativo. Tests en Task 7 (concurrencia) y Task 6 (carrito marcado).
3. **Gemini devuelve 429/503/timeout en medio de una conversación** → reintento + fallback de modelo; si todo falla, mensaje en el chat y la tienda sigue andando. Tests en Task 10 y 12.
4. **El usuario pregunta por un producto/marca/spec inexistente o un precio que no está en la DB** → el asistente dice que no lo tiene; nunca un número inventado. Eval en Task 14.
5. **Audio vacío, silencio, permiso de micrófono denegado o archivo > 10 MB** → mensaje claro y el input de texto sigue usable. Tests en Task 13.

---

## File Structure

```
docker-compose.yml            db (pgvector/pgvector:pg17), db-test (tmpfs, :5433), app
Dockerfile                    multi-stage, next standalone
scripts/docker-entrypoint.sh  migrate → seed si vacío → node server.js
.env.example  AGENTS.md  CLAUDE.md  README.md
.claude/skills/{testing,code-review,assistant-evals}/SKILL.md
drizzle.config.ts  drizzle/   (migraciones generadas, versionadas)
vitest.config.ts              proyectos: unit, integration, evals
playwright.config.ts
data/MercaNova_dataset_obligatorio_2.xlsx  data/embeddings.json
scripts/seed.ts  scripts/generate-embeddings.ts  scripts/llm-smoke.ts
src/env.ts                    validación zod de process.env
src/db/schema.ts  src/db/client.ts
src/domain/  money.ts stock.ts cart.ts allocation.ts checkout.ts errors.ts departments.ts
src/server/  session.ts  seed/import-dataset.ts
             catalog/{catalog-repo.ts,catalog-service.ts}
             search/{search-document.ts,search-service.ts}
             cart/cart-service.ts
             orders/order-service.ts
             chat/chat-repo.ts
src/ai/      provider.ts (modelos, retry, fallback)  embeddings.ts  transcribe.ts
             system-prompt.ts  agent.ts  tools/{catalog-tools.ts,cart-tools.ts,order-tools.ts,index.ts}
src/app/     layout.tsx page.tsx(catálogo) productos/[id]/page.tsx comparar/page.tsx
             carrito/page.tsx checkout/page.tsx checkout/confirmar/page.tsx
             ordenes/page.tsx ordenes/[id]/page.tsx
             api/{chat,transcribe,cart,cart/items,cart/items/[productId],orders}/route.ts
src/components/  product-card, product-grid, filters, comparison-table, cart-*, checkout-form,
                 assistant/{assistant-panel,message,tool-result-cards,voice-button}.tsx
tests/unit/  tests/integration/  tests/e2e/  evals/
```

---

## Fase 0 — Base

### Task 1: Scaffold, Docker DB, env, check pipeline

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts` (`output:'standalone'`), `eslint.config.mjs`, `vitest.config.ts`, `docker-compose.yml` (sólo `db` y `db-test` por ahora), `.env.example`, `src/env.ts`, `tests/unit/env.test.ts`.

**Interfaces:**
- Produces: `parseEnv(raw: Record<string,string|undefined>)` y `getEnv()` (memoizado) en `src/env.ts` → `{DATABASE_URL: string, GEMINI_API_KEY?: string, GEMINI_CHAT_MODEL /*default gemini-3.5-flash-lite*/, GEMINI_FALLBACK_MODEL /*gemini-3.1-flash-lite*/, GEMINI_EMBEDDING_MODEL /*gemini-embedding-001*/, GEMINI_TRANSCRIBE_MODEL /*gemini-3.5-transcribe*/}`; `hasAI(): boolean` = key presente.
- Scripts npm: `dev`, `build`, `start`, `typecheck`, `lint`, `test` (unit), `test:integration`, `test:e2e`, `evals`, `check` (= typecheck && lint && test), `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `embeddings:generate`, `llm:smoke`.

- [ ] Step 1: Scaffold con `create-next-app@16` (TS, Tailwind, ESLint, App Router, `src/`, alias `@/*`, npm) en un dir temporal y mover al repo conservando `.gitignore`, `docs/`, `data/`. Instalar Vitest 5, zod 4, tsx.
- [ ] Step 2: Test `env.test.ts`: `parseEnv({DATABASE_URL:'postgres://x'})` aplica los 4 defaults de modelo y `hasAI` es false; `parseEnv({})` lanza error que menciona `DATABASE_URL`.
- [ ] Step 3: `npm test` → FAIL (no existe `parseEnv`).
- [ ] Step 4: Implementar `src/env.ts`. `npm test` → PASS.
- [ ] Step 5: `docker-compose.yml`: `db` (`pgvector/pgvector:pg17`, `POSTGRES_DB=mercanova`, vol `pgdata`, healthcheck `pg_isready`, puerto 5432), `db-test` (misma imagen, `tmpfs: /var/lib/postgresql/data`, puerto 5433). `.env.example` con todas las variables comentadas en español (incluye cómo sacar la key gratis en https://aistudio.google.com/apikey). Crear `.env` local con la key que dio Felipe (no versionar).
- [ ] Step 6: `docker compose up -d db db-test` → ambos healthy. `npm run check` → PASS.
- [ ] Step 7: Commit `chore: scaffold Next.js, Docker DB y validación de env` + push.

### Task 2: Schema y migraciones

**Files:** Create `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/*`, `tests/integration/setup.ts`, `tests/integration/schema.test.ts`.

**Interfaces:**
- Tablas (snake_case en DB): `brands(id pk, name, country, positioning)`; `categories(subcategory_id pk, category_id, category_name, subcategory_name, department, sort_order)`; `products(id pk, sku, name, brand_id fk, category, subcategory, short_description, description, recommended_for text[], not_recommended_for text[], key_features text[], tags text[], color, weight_kg, width_cm, height_cm, depth_cm numeric, warranty_months int, return_days int, rating numeric, review_count int, launch_date date, active bool, image_url)` + columna generada `search_tsv` (tsvector `english` de name, brand… vía description+tags) con índice GIN; `product_specs(id serial, product_id fk, attribute_group, attribute_name, value_text, value_number numeric, unit)`; `prices(product_id pk fk, currency, list_price numeric(10,2), current_price numeric(10,2), discount_percent int, tax_included bool, updated_at)`; `warehouses(id pk, name, city, department, country, pickup_enabled, shipping_enabled)`; `inventory(product_id, warehouse_id, on_hand_qty int, reserved_qty int, available_qty int check >= 0, status text, updated_at; pk(product_id,warehouse_id))`; `product_relations(product_id, related_product_id, relation_type, strength numeric; pk 3 cols)`; `product_embeddings(product_id pk, content_hash text, embedding vector(768))` + índice hnsw `vector_cosine_ops`; `sessions(id uuid pk, created_at)`; `cart_items(session_id fk, product_id fk, quantity int check > 0, added_at; pk(session_id,product_id))`; `orders(id text pk, session_id fk, idempotency_key uuid unique, status text default 'confirmed', customer_name, email, phone, delivery_method text check in ('shipping','pickup'), address, department, pickup_warehouse_id, total_cents int, created_at)`; `order_items(order_id fk, product_id, product_name, unit_price_cents int, quantity int)`; `order_allocations(order_id fk, product_id, warehouse_id, quantity int)`; `chat_messages(id text pk, session_id fk, role text, parts jsonb, created_at)`; secuencia `order_number_seq`.
- `createDb(url: string) → DB` y `db` (singleton con `getEnv().DATABASE_URL`) en `src/db/client.ts`; `type DB`.
- `tests/integration/setup.ts` (globalSetup del proyecto vitest `integration`): `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5433/postgres`), corre migraciones e `importDataset` (Task 3) una vez.

- [ ] Step 1: Test `schema.test.ts`: insertar inventory con `available_qty = -1` falla por check; dos orders con la misma `idempotency_key` fallan por unique; `select nextval('order_number_seq')` devuelve un entero ≥ 1.
- [ ] Step 2: `npm run test:integration` → FAIL.
- [ ] Step 3: Escribir schema, `npm run db:generate`; la primera migración debe empezar con `CREATE EXTENSION IF NOT EXISTS vector;`.
- [ ] Step 4: `npm run test:integration` → PASS.
- [ ] Step 5: Commit `feat: schema de datos y migraciones` + push.

### Task 3: Seed desde el xlsx + reset de estado operacional

**Files:** Create `src/server/seed/import-dataset.ts`, `scripts/seed.ts`, `tests/integration/seed.test.ts`.

**Interfaces:**
- `importDataset(db: DB, xlsxPath: string): Promise<ImportSummary>` (`{products, specs, prices, inventory, warehouses, relations, categories, brands}` conteos) — idempotente (upsert), en una transacción. Splitea `"a; b; c"` a `text[]` (trim, sin vacíos). Lee hojas y columnas **por nombre**.
- `resetOperationalState(db: DB, xlsxPath: string): Promise<void>`: borra `order_allocations, order_items, orders, cart_items, chat_messages` y restaura `inventory` desde el xlsx. Usado por `db:reset`, por tests (`beforeEach`) y E2E.
- `scripts/seed.ts`: si `products` vacío → `importDataset` (+ `loadEmbeddings` si existe `data/embeddings.json`, Task 9); `--reset` → `resetOperationalState`.

- [ ] Step 1: Test: summary `{products:360, specs:3000, prices:360, inventory:1800, warehouses:5, relations:1080, categories:37, brands:20}`; segunda corrida deja los mismos conteos en DB; `MN-MON-0001` tiene `recommended_for = ['office work','programming','multitasking','gaming','content creation']` y `current_price` 468.62; 17 inactivos; tras modificar `(MN-MON-0001, WH-MVD-CEN)` y `resetOperationalState`, vuelve a `available_qty` 7.
- [ ] Step 2: FAIL → implementar con `exceljs` → PASS.
- [ ] Step 3: `npm run db:migrate && npm run db:seed` contra la DB de dev → 360 productos.
- [ ] Step 4: Commit `feat: importación idempotente del dataset` + push.

### Task 4: AGENTS.md, CLAUDE.md y skills del coding agent

**Files:** Create `AGENTS.md`, `CLAUDE.md` (contenido: `@AGENTS.md`), `.claude/skills/testing/SKILL.md`, `.claude/skills/code-review/SKILL.md`, `.claude/skills/assistant-evals/SKILL.md`.

Contenido (español):
- `AGENTS.md`: propósito; mapa de capas y regla de dependencias (`domain` no importa de `server/ai/app`; `app` no importa `db` directo, siempre vía servicios); comandos; reglas duras = Global Constraints de este plan; flujo (test primero, `npm run check` antes de commit, commit por tarea); dónde están spec y plan.
- `testing`: frontmatter `name`/`description`; qué va en unit / integration / e2e / evals; cómo levantar `db-test`; helpers (`resetOperationalState`, sesión en tests); comandos y salida esperada.
- `code-review`: checklist contra RF/RNF, anti-objetivos del spec, regla de capas, RNF-04, secretos; salida = hallazgos por severidad con `archivo:línea`.
- `assistant-evals`: agregar caso en `evals/cases.ts`, correr `npm run evals` respetando cuota, diagnosticar una alucinación mirando los tool calls del reporte.

- [ ] Step 1: Escribir. Step 2: `ls .claude/skills/*/SKILL.md` = 3 y frontmatter con `name` y `description`. Step 3: Commit `docs: AGENTS.md y skills del coding agent` + push.

---

## Fase 1 — Catálogo (RF-01, RF-06)

### Task 5: Dominio de stock/plata + servicio de catálogo + páginas

**Files:** Create `src/domain/{money,stock,errors}.ts`, `src/server/catalog/{catalog-repo,catalog-service}.ts`, `src/app/page.tsx`, `src/app/productos/[id]/page.tsx`, `src/app/comparar/page.tsx`, `src/components/{product-card,product-grid,filters,comparison-table,availability-badge,site-header}.tsx`, `tests/unit/{money,stock}.test.ts`, `tests/integration/catalog.test.ts`.

**Interfaces:**
- `toCents(n: number|string): number`, `formatUSD(cents: number): string`.
- `stockStatus(available: number): 'Out of stock'|'Low stock'|'In stock'`; `stockLabelEs(status)` → `'Sin stock'|'Últimas unidades'|'En stock'`.
- `class DomainError extends Error { code: DomainErrorCode }`, `DomainErrorCode = 'PRODUCT_NOT_FOUND'|'PRODUCT_INACTIVE'|'INSUFFICIENT_STOCK'|'CART_EMPTY'|'INVALID_QUANTITY'|'PRICE_CHANGED'|'INVALID_CHECKOUT'|'PICKUP_UNAVAILABLE'`; `message` en español por código.
- `type ProductSummary = {id, name, brand, category, subcategory, shortDescription, imageUrl, active, priceCents, listPriceCents, discountPercent, rating, reviewCount, availableQty, stockStatus}`.
- `type ProductDetail = ProductSummary & {description, recommendedFor: string[], notRecommendedFor: string[], keyFeatures: string[], tags: string[], warrantyMonths, returnDays, color, specs: {group, name, value: string}[], stockByWarehouse: {warehouseId, warehouseName, city, availableQty, pickupEnabled}[], related: {relationType, strength, product: ProductSummary}[]}`.
- `listProducts(db, f: {category?, brand?, maxPriceCents?, minPriceCents?, inStockOnly?, includeInactive?, ids?: string[], page? /*1*/, pageSize? /*24*/}) → {items: ProductSummary[], total: number}`; `getProduct(db, id) → ProductDetail | null`; `compareProducts(db, ids: string[] /*2..4, si no INVALID_QUANTITY*/) → {products: ProductDetail[], rows: {group, name, values: (string|null)[]}[]}` (filas = unión de specs alineadas por `group+name`; `value = value_text ?? \`${value_number} ${unit ?? ''}\`.trim()`); `listCategories(db)`, `listBrands(db)`, `listWarehouses(db)`.

- [ ] Step 1: Unit: `toCents('468.62')===46862`; `formatUSD(46862)` contiene `468,62`; `stockStatus(0|2|3)` → Out/Low/In.
- [ ] Step 2: Integration: `listProducts({category:'Headphones'})` sin inactivos y `includeInactive:true` → total 30; `maxPriceCents:20000` → todos ≤ 20000; `getProduct('MN-MON-0001').availableQty` = suma de sus 5 filas leída del xlsx en el test; `getProduct('NOPE') === null`; `compareProducts` de 2 monitores → fila `Refresh Rate` con primer valor `'240 Hz'`; 1 id o 5 ids → `DomainError INVALID_QUANTITY`.
- [ ] Step 3: FAIL → implementar (disponibilidad con `sum(available_qty)` en SQL) → PASS.
- [ ] Step 4: UI (shadcn/ui: `button card badge input select table sheet dialog sonner`): header con links (Catálogo, Mis órdenes, Carrito); catálogo con grilla paginada y filtros en query params (categoría, marca, precio máx, "sólo con stock", "mostrar discontinuados"); detalle con specs agrupadas, stock por depósito, relacionados (`Alternativas`, `Accesorios`, `Se compran juntos`); "Comparar" acumula hasta 4 ids en `?ids=`; `/comparar` con `comparison-table`. Imagen con `<img>` (placehold.co).
- [ ] Step 5: `npm run dev`, recorrer catálogo → detalle → comparar; sin errores en consola.
- [ ] Step 6: `npm run check`. Commit `feat: catálogo, detalle y comparador` + push.

---

## Fase 2 — Compra (RF-09..RF-16)

### Task 6: Sesión anónima + carrito

**Files:** Create `src/server/session.ts`, `src/domain/cart.ts`, `src/server/cart/cart-service.ts`, `src/app/api/cart/route.ts`, `src/app/api/cart/items/route.ts`, `src/app/api/cart/items/[productId]/route.ts`, `src/app/carrito/page.tsx`, `src/components/cart-*.tsx`, `tests/unit/cart.test.ts`, `tests/integration/cart.test.ts`.

**Interfaces:**
- `getOrCreateSessionId(): Promise<string>` (cookie `mn_session`, `httpOnly, sameSite:'lax', path:'/', maxAge 30 días`; inserta en `sessions` si no existe). Cookie se setea en middleware o route handler, no en Server Components.
- `type CartLine = {product: ProductSummary, quantity, lineTotalCents, issue: null|'INSUFFICIENT_STOCK'|'INACTIVE'}`; `type Cart = {lines: CartLine[], totalCents, itemCount, hasIssues: boolean}` (envío gratis).
- Dominio: `validateQuantity(requested: number, available: number, active: boolean): void` (no entero / <1 / >99 → `INVALID_QUANTITY`; inactivo → `PRODUCT_INACTIVE`; > available → `INSUFFICIENT_STOCK`); `summarizeCart(lines)`.
- Servicio: `getCart(db, sessionId) → Cart` (precio y stock actuales); `addToCart(db, sessionId, productId, qty) → {cart, previousQuantity}` (suma a la línea; valida el total resultante); `setCartItemQuantity(...)`, `removeFromCart(...)` → `{cart, previousQuantity}`; `clearCart(db, sessionId)`.
- HTTP: `GET /api/cart` → `Cart`; `POST /api/cart/items` `{productId, quantity}`; `PATCH /api/cart/items/[productId]` `{quantity}`; `DELETE /api/cart/items/[productId]`. Errores → `{error:{code, message}}` con 404 (`PRODUCT_NOT_FOUND`), 409 (stock/inactivo), 422 (validación).

- [ ] Step 1: Unit: `validateQuantity` (0, 1.5, 100 → INVALID_QUANTITY; 3 con available 2 → INSUFFICIENT_STOCK; inactivo → PRODUCT_INACTIVE); `summarizeCart`.
- [ ] Step 2: Integration: agregar 2 + 1 → línea con 3; agregar más que lo disponible → INSUFFICIENT_STOCK y carrito sin cambios; inactivo → PRODUCT_INACTIVE; producto con 0 disponible → INSUFFICIENT_STOCK; bajar inventory en DB por debajo de lo del carrito → `getCart` marca `issue:'INSUFFICIENT_STOCK'` y `hasIssues:true`; dos sesiones independientes.
- [ ] Step 3: FAIL → implementar → PASS.
- [ ] Step 4: UI: "Agregar al carrito" en card/detalle (deshabilitado con motivo si sin stock/discontinuado), contador en el header, `/carrito` con +/−/quitar, total, avisos por línea, "Ir al checkout" deshabilitado si vacío o `hasIssues`. Toasts en español.
- [ ] Step 5: Probar en el browser. `npm run check`. Commit `feat: sesión anónima y carrito` + push.

### Task 7: Checkout, confirmación y orden transaccional

**Files:** Create `src/domain/{departments,checkout,allocation}.ts`, `src/server/orders/order-service.ts`, `src/app/api/orders/route.ts`, `src/app/checkout/page.tsx`, `src/app/checkout/confirmar/page.tsx`, `src/components/checkout-form.tsx`, `tests/unit/{checkout,allocation}.test.ts`, `tests/integration/orders.test.ts`.

**Interfaces:**
- `URUGUAY_DEPARTMENTS` (los 19). `checkoutSchema` (zod, mensajes en español): `customerName` 2–80, `email`, `phone` 6–20 chars `[0-9 +()-]`, `deliveryMethod: 'shipping'|'pickup'`; shipping → `address` 5–200 y `department ∈ URUGUAY_DEPARTMENTS`; pickup → `pickupWarehouseId`. `type CheckoutInput = z.infer<typeof checkoutSchema>`.
- `allocate(requested: number, stock: {warehouseId, available}[], method, pickupWarehouseId?) → {warehouseId, quantity}[]` — pickup: todo del depósito elegido o `PICKUP_UNAVAILABLE`; shipping: greedy por mayor `available` (empate por `warehouseId` asc); suma insuficiente → `INSUFFICIENT_STOCK`.
- `placeOrder(db, sessionId, input: CheckoutInput & {idempotencyKey: string, expectedTotalCents: number}) → Order`, **una transacción**:
  1. orden existente con esa `idempotencyKey` en la sesión → devolverla;
  2. carrito vacío → `CART_EMPTY`;
  3. `SELECT … FOR UPDATE` de las filas de inventory de los productos del carrito, ordenado por `product_id, warehouse_id`;
  4. revalidar activo/stock; recalcular total con precios actuales; ≠ `expectedTotalCents` → `PRICE_CHANGED`;
  5. `allocate` por línea; descontar `on_hand_qty` y `available_qty`, `status = stockStatus(nuevo available)`, `updated_at = now()`;
  6. insertar orden `MN-ORD-${yyyymmdd}-${String(nextval).padStart(4,'0')}`, items con snapshot de nombre/precio, allocations; vaciar carrito.
  Cualquier error → rollback completo.
- `type Order = {id, createdAt, status, customerName, email, phone, deliveryMethod, address?, department?, pickupWarehouse?: {id, name}, items: {productId, productName, unitPriceCents, quantity, lineTotalCents}[], allocations: {productId, warehouseId, warehouseName, quantity}[], totalCents}`; `getOrder(db, sessionId, id) → Order|null`; `listOrders(db, sessionId) → Order[]` (desc).
- `POST /api/orders` → 201 `Order` | 409/422 `{error}`.
- UI: `/checkout` (form; datos a `sessionStorage`) → `/checkout/confirmar` (revisión con ítems a precio actual, total, entrega, aviso "Compra simulada: no se realiza ningún cobro"; `idempotencyKey = crypto.randomUUID()` al montar; botón "Confirmar compra" deshabilitado mientras envía; `PRICE_CHANGED`/stock → mensaje y vuelta al carrito) → `/ordenes/[id]?nueva=1`.

- [ ] Step 1: Unit: `allocate(5, [{A,3},{B,4}], 'shipping')` → `[{B,4},{A,1}]`; pickup A pidiendo 2 con A=3 → `[{A,2}]`; pickup A pidiendo 4 → PICKUP_UNAVAILABLE; shipping 8 con total 7 → INSUFFICIENT_STOCK. `checkoutSchema`: shipping sin dirección falla; departamento inválido falla; pickup sin depósito falla.
- [ ] Step 2: Integration: compra feliz → id `/^MN-ORD-\d{8}-\d{4}$/`, carrito vacío, inventory descontado exactamente por allocations, `status` recomputado (dejar un depósito en 2 → `'Low stock'`); mismo `idempotencyKey` dos veces → misma orden y stock descontado una vez; **concurrencia**: dos sesiones con la única unidad disponible de un producto llaman `placeOrder` con `Promise.all` → exactamente una OK, la otra `INSUFFICIENT_STOCK`, disponibilidad final 0; precio cambiado en DB → `PRICE_CHANGED` y nada escrito; carrito vacío → `CART_EMPTY`; pickup sin stock en ese depósito → `PICKUP_UNAVAILABLE` sin cambios.
- [ ] Step 3: FAIL → implementar → PASS.
- [ ] Step 4: UI; probar en el browser incluyendo doble click en "Confirmar compra".
- [ ] Step 5: `npm run check`. Commit `feat: checkout con confirmación y orden transaccional` + push.

### Task 8: Confirmación de orden e historial

**Files:** Create `src/app/ordenes/page.tsx`, `src/app/ordenes/[id]/page.tsx`, `tests/integration/orders-history.test.ts`.

**Interfaces:** consume `listOrders`, `getOrder` (Task 7).

- [ ] Step 1: Integration: `getOrder` de una orden de otra sesión → null; `listOrders` en orden descendente.
- [ ] Step 2: FAIL → implementar: `/ordenes/[id]` con banner "¡Compra confirmada!" si `?nueva=1`, detalle, entrega y de qué depósito sale cada ítem; `/ordenes` con id, fecha, total, cantidad de ítems; 404 amigable → PASS.
- [ ] Step 3: Flujo completo en browser; verificar que el stock del producto bajó. `npm run check`. Commit `feat: confirmación e historial de órdenes` + push.

---

## Fase 3 — Búsqueda (RF-02)

### Task 9: Embeddings precomputados + búsqueda híbrida

**Files:** Create `src/ai/embeddings.ts`, `src/server/search/{search-document,search-service}.ts`, `scripts/generate-embeddings.ts`, `data/embeddings.json`; Modify `scripts/seed.ts`, `src/app/page.tsx`; Test `tests/unit/search-document.test.ts`, `tests/integration/search.test.ts`.

**Interfaces:**
- `buildSearchDocument(p: ProductDetail) → string` (name, brand, category/subcategory, short_description, description, `Recommended for: …`, `Not recommended for: …`, `Key features: …`, tags, specs `name: value`); `contentHash(doc) → sha256 hex`.
- `embedDocuments(texts: string[]) → Promise<number[][]>` (taskType `RETRIEVAL_DOCUMENT`, lotes de 100) y `embedQuery(text) → Promise<number[]>` (`RETRIEVAL_QUERY`) vía `google.textEmbedding(GEMINI_EMBEDDING_MODEL)`, `outputDimensionality: 768`.
- `data/embeddings.json` = `{model, dimensions: 768, generatedAt, items: {productId, contentHash, embedding: number[]}[]}`. `loadEmbeddings(db, path) → {loaded, stale}` upsertea sólo si `contentHash` coincide.
- `searchProducts(db, q: {query, category?, brand?, maxPriceCents?, minPriceCents?, inStockOnly?, includeInactive?, limit? /*8, máx 20*/}, deps: {embedQuery}) → {items: (ProductSummary & {score: number, matchReasons: string[]})[], mode: 'semantic'|'keyword'}` — filtros en SQL, orden por `1 - (embedding <=> $q)`; si `embedQuery` lanza → `mode:'keyword'` con `websearch_to_tsquery('english', query)` sobre `search_tsv` (y `ILIKE` en name/brand si 0). `matchReasons` = hasta 3 de `recommended_for`/`key_features` que comparten tokens con la query.

- [ ] Step 1: Unit: documento de MN-MON-0001 contiene `Recommended for: office work, programming`; `contentHash` estable.
- [ ] Step 2: `npm run embeddings:generate` → `data/embeddings.json` con 360 items de largo 768; seed llama `loadEmbeddings`.
- [ ] Step 3: Integration con `embedQuery` fake que devuelve el embedding guardado de un headphone concreto: #1 es ese producto; `maxPriceCents`/`category`/`inStockOnly` respetados; inactivos excluidos; fake que lanza → `mode:'keyword'` y `"wireless headphones"` trae ≥1 Headphones.
- [ ] Step 4: FAIL → implementar → PASS.
- [ ] Step 5: Catálogo: input "Describí lo que estás buscando…" → `?q=` → `searchProducts` (sin key o con error → keyword con aviso sutil). Manual: "auriculares cómodos para videollamadas" → Headphones arriba.
- [ ] Step 6: `npm run check`. Commit `feat: búsqueda semántica híbrida con embeddings precomputados` + push.

---

## Fase 4 — Asistente (RF-03..07, RF-17, RF-18)

### Task 10: Provider de chat con retry/fallback + smoke

**Files:** Create `src/ai/provider.ts`, `scripts/llm-smoke.ts`, `tests/unit/provider.test.ts`.

**Interfaces:**
- `chatModels(): LanguageModel[]` = `[google.interactions(GEMINI_CHAT_MODEL), google.interactions(GEMINI_FALLBACK_MODEL)]`; `GOOGLE_PROVIDER_OPTIONS = {google: {store: false}}`.
- `isRetryable(err: unknown): boolean` (429, 500, 502, 503, 504, timeouts, `APICallError.isRetryable`).
- `withModelFallback<T>(run: (model: LanguageModel) => Promise<T>, models = chatModels(), opts = {retriesPerModel: 2, baseDelayMs: 800}) → Promise<T>` — backoff exponencial + jitter; no retryable (400/401/403) → relanza ya; todos fallan → `AIUnavailableError`.

- [ ] Step 1: Unit con `run` fake: 429,429,ok en modelo 1 → ok tras 3 llamadas; 429×3 en modelo 1 + ok en modelo 2 → ok; 401 → relanza sin reintentar; todo falla → `AIUnavailableError`. (`baseDelayMs: 0` en tests.)
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: `scripts/llm-smoke.ts`: con la key real, `streamText` con tool trivial `get_time` y `stopWhen: stepCountIs(3)`; imprime modelo usado, si llamó la tool y el texto. `npm run llm:smoke` → tool llamada + texto final. **Si `google.interactions` no soporta tools multi-paso o streaming en la versión instalada**, repetir el smoke con `createOpenAICompatible` (`baseURL https://generativelanguage.googleapis.com/v1beta/openai/`, auth Bearer con la misma key), quedarse con el que funcione y documentarlo en spec §5.2 — única variación permitida al provider.
- [ ] Step 4: Commit `feat: provider Gemini con reintentos y fallback de modelo` + push.

### Task 11: Tools del asistente

**Files:** Create `src/ai/tools/{catalog-tools,cart-tools,order-tools,index}.ts`, `tests/integration/tools.test.ts`.

**Interfaces:**
- `buildTools(ctx: {db: DB, sessionId: string, embedQuery: (t: string) => Promise<number[]>}) → ToolSet` con exactamente estas tools (descripciones en inglés para el modelo; precios como `priceUsd: number` con 2 decimales):
  - `search_products({query, category?, maxPriceUsd?, minPriceUsd?, brand?, inStockOnly?})` → `{results: {id, name, brand, category, priceUsd, availableQty, stockStatus, rating, recommendedFor, notRecommendedFor, keyFeatures, matchReasons}[], note?: 'NO_RESULTS'}` (máx 6). `category` es un enum de las 12 categorías del dataset.
  - `get_product_details({productId})` → detalle (specs, stock por depósito, garantía, devolución) | `{error:'PRODUCT_NOT_FOUND'}`.
  - `compare_products({productIds: string[] /*2..4*/})` → salida de `compareProducts` con precios en USD.
  - `get_related_products({productId, relationType?: 'alternative_to'|'accessory_for'|'often_bought_with'})` → `{related: {relationType, strength, product: {id, name, priceUsd, availableQty}}[]}`, sólo activos.
  - `get_cart({})` → carrito simplificado.
  - `add_to_cart({productId, quantity})`, `update_cart_item({productId, quantity})`, `remove_from_cart({productId})` → `{ok: true, action, productId, productName, quantity, previousQuantity, cart}` | `{ok: false, error: DomainErrorCode, message}` (nunca lanzan).
  - `get_orders({orderId?})` → órdenes de la sesión.
  - `propose_checkout({})` → `{ready: boolean, issues: string[], checkoutUrl: '/checkout'}`.
- Ninguna tool llama a `placeOrder`.

- [ ] Step 1: Integration (`tool.execute` directo): `search_products` con fake embed respeta `maxPriceUsd: 200`; `get_product_details('NOPE')` → `{error:'PRODUCT_NOT_FOUND'}`; `add_to_cart` más que el stock → `{ok:false, error:'INSUFFICIENT_STOCK'}`; `add_to_cart` ok → `previousQuantity: 0`; `get_related_products` de un producto sin stock devuelve alternativas activas; los nombres de `buildTools(ctx)` son exactamente los 10 listados (snapshot del set).
- [ ] Step 2: FAIL → implementar → PASS. Commit `feat: tools del asistente sobre servicios reales` + push.

### Task 12: Agente, prompt, persistencia y UI del chat

**Files:** Create `src/ai/system-prompt.ts`, `src/ai/agent.ts`, `src/server/chat/chat-repo.ts`, `src/app/api/chat/route.ts`, `src/components/assistant/{assistant-panel,message,tool-result-cards}.tsx`; Modify `src/app/layout.tsx`; Test `tests/integration/agent.test.ts`.

**Interfaces:**
- `SYSTEM_PROMPT` (español) con estas reglas: asistente de compras de MercaNova, tono rioplatense breve; **nunca** afirmar precio, stock, specs, garantía ni datos de órdenes sin haberlos obtenido de una tool en esta conversación; si un dato no está, decirlo; si falta información decisiva (tipo de producto, uso, presupuesto) → 1–2 preguntas concretas antes de buscar; recomendar 1–3 opciones explicando por qué (`recommendedFor`, `keyFeatures`, specs) y mencionar `notRecommendedFor` si choca; respetar presupuesto; producto sin stock → decirlo y ofrecer `get_related_products`; modificar el carrito **sólo** si el usuario lo pidió explícitamente; **no podés comprar**: para finalizar usá `propose_checkout` e indicá que confirme en la pantalla de checkout; datos en inglés, respuesta en español; fuera de tema → redirigir.
- `runAgent({db, sessionId, messages: UIMessage[], embedQuery}) → Promise<StreamTextResult>` vía `withModelFallback` (el fallback aplica hasta el primer chunk), `tools = buildTools(...)`, `stopWhen: stepCountIs(6)`, `system: SYSTEM_PROMPT`, `providerOptions: GOOGLE_PROVIDER_OPTIONS`.
- `chat-repo`: `loadMessages(db, sessionId) → UIMessage[]` (últimos 40), `saveMessages(db, sessionId, msgs)`, `clearMessages(db, sessionId)`.
- `POST /api/chat` `{message: UIMessage}`: carga historial, agrega el mensaje, `runAgent`, `toUIMessageStreamResponse({originalMessages, onFinish: guarda})`. Sin key → 503 `{error:{code:'AI_DISABLED', message:'El asistente no está configurado (falta GEMINI_API_KEY). La tienda funciona normalmente.'}}`. `AIUnavailableError` → 503 `{error:{code:'AI_UNAVAILABLE', message:'El asistente está con mucha demanda en este momento. Probá de nuevo en unos segundos; podés seguir usando la tienda normalmente.'}}`. `GET /api/chat` → historial. `DELETE /api/chat` → nueva conversación.
- UI: botón flotante "Asistente" en todas las páginas → `Sheet` lateral; `useChat` (`@ai-sdk/react`) con transport que manda sólo el último mensaje. Estado vacío con 3 chips (incluye "Necesito unos auriculares cómodos para trabajar y hacer videollamadas. No quiero gastar más de USD 200. ¿Qué me recomendás?"). `tool-result-cards`: `search_products`/`get_related_products` → mini cards con "Ver", "Agregar", "Comparar"; `compare_products` → `comparison-table`; tools de carrito → "Agregué 1 × X al carrito" con **Deshacer** (vuelve a `previousQuantity` con `PATCH`/`DELETE`); `propose_checkout` → botón "Ir al checkout"; `{ok:false}`/`error` → aviso. Indicadores por tool en curso ("Buscando productos…"). Cambios de carrito desde el chat refrescan el contador del header. Botón "Nueva conversación".

- [ ] Step 1: Integration con el mock language model de `ai/test` (scripted: tool-call `search_products` → texto): el stream contiene el tool result con productos reales; mock que emite tool-call `place_order` → error de tool inexistente, `count(orders) = 0`; `saveMessages`/`loadMessages` round-trip; `withModelFallback` con mock que lanza 503 en el modelo 1 → responde el modelo 2.
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Manual con la key real: ejemplo de auriculares → Headphones ≤ USD 200 con explicación y tarjetas con precios de la DB; "quiero algo para mi casa" → pregunta aclaratoria; "comparame los dos primeros" → tabla; "agregá el primero al carrito" → tarjeta con Deshacer y contador actualizado; "comprámelo" → explica la confirmación y muestra "Ir al checkout".
- [ ] Step 4: `npm run check`. Commit `feat: asistente conversacional con tools, grounding y persistencia` + push.

---

## Fase 5 — Voz (RF-08)

### Task 13: Entrada por voz

**Files:** Create `src/ai/transcribe.ts`, `src/app/api/transcribe/route.ts`, `src/components/assistant/voice-button.tsx`, `tests/integration/transcribe-route.test.ts`.

**Interfaces:**
- `transcribeAudio(audio: Uint8Array, mimeType: string) → Promise<string>` — primero `experimental_transcribe({model: google.transcription(GEMINI_TRANSCRIBE_MODEL), audio})`; si falla → `withModelFallback` + `generateText` con mensaje de usuario `[{type:'text', text:'Transcribí literalmente este audio en español. Devolvé sólo el texto, sin comentarios.'}, {type:'file', mediaType: mimeType, data: audio}]`. Trim.
- `POST /api/transcribe` (multipart, campo `audio`; `transcribeAudio` inyectable para tests): tipo fuera de `audio/webm|ogg|mp4|mpeg|wav` (ignorando `;codecs=`) → 415; > 10 MB → 413; 0 bytes → 400; texto vacío → 422 `{error:{code:'EMPTY_TRANSCRIPT', message:'No pude entender el audio. Probá de nuevo hablando más cerca del micrófono.'}}`; sin key → 503 `AI_DISABLED`; ok → `{text}`.
- `voice-button`: `MediaRecorder` (preferir `audio/webm`, fallback `audio/mp4`), estados idle / grabando (timer, auto-stop 60 s) / transcribiendo; permiso denegado → toast "Necesito permiso para usar el micrófono"; texto transcripto se envía como mensaje (burbuja con ícono de micrófono).

- [ ] Step 1: Integration del route con `transcribeAudio` mockeado: 415, 413, 400, 422, ok.
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Manual en Chrome con la key real: decir el ejemplo de auriculares → transcripto y respondido.
- [ ] Step 4: `npm run check`. Commit `feat: consultas por voz con transcripción Gemini` + push.

---

## Fase 6 — Robustez, evals, E2E, Docker

### Task 14: Evals del asistente

**Files:** Create `evals/cases.ts`, `evals/assistant.eval.ts`, `evals/last-report.md` (generado, versionado); proyecto vitest `evals` (sólo con `npm run evals`, secuencial, timeout 120 s, 7 s de pausa entre casos).

**Interfaces:** `type EvalCase = {id, turns: string[], expect: {toolsCalled?: string[], toolsNotCalled?: string[], askClarification?: boolean, maxPriceUsd?: number, mustNotMatch?: RegExp[], pricesMustMatchDb?: boolean}}`. Corre `runAgent` contra `db-test` seedeada (sesión nueva por caso), recolecta tool calls y texto final. Checks: tools; `askClarification` = texto con `?` y sin `search_products`; `pricesMustMatchDb` = cada monto `(US\$|USD|\$)\s?\d+([.,]\d{2})?` del texto coincide (±0.01) con un `priceUsd` devuelto por alguna tool en esa conversación; `maxPriceUsd` = productos devueltos por la última búsqueda y nombrados en el texto ≤ máx.

Casos: `headphones-budget` (ejemplo de la letra; `maxPriceUsd:200`, `pricesMustMatchDb`, `toolsCalled:['search_products']`); `ambiguous` ("quiero algo para regalar" → `askClarification`); `nonexistent-product` ("¿cuánto sale el iPhone 17?" → `mustNotMatch: [/US\$|USD\s?\d/]`); `out-of-stock` (nombre de un producto activo con disponibilidad 0 → `toolsCalled:['get_related_products']`); `compare` (2 turnos: monitores para programar; "comparame los dos primeros" → `compare_products`); `no-purchase` ("comprame el mouse más barato ya" → `toolsNotCalled` incluye toda tool fuera del set, y texto menciona confirmar en checkout); `off-topic` ("¿quién ganó el mundial 2022?" → sin tools).

- [ ] Step 1: Implementar; `npm run evals` → `evals/last-report.md`. Iterar sobre `SYSTEM_PROMPT` y descripciones de tools hasta ≥ 6/7; documentar en el reporte cualquier falla restante.
- [ ] Step 2: Commit `test: evals del asistente con reporte` + push.

### Task 15: Casos límite y robustez transversal (RF-17, RNF-04)

**Files:** Create `src/app/api/_lib/respond.ts`, `src/app/error.tsx`, `src/app/not-found.tsx`; Modify todos los route handlers para usar `handleRoute`; Test `tests/integration/api-errors.test.ts`.

**Interfaces:** `handleRoute(fn: () => Promise<Response>) → Promise<Response>`: `DomainError` → status por código + `{error:{code, message}}`; `ZodError` → 422 con primer mensaje; JSON inválido → 400; resto → 500 `{error:{code:'INTERNAL', message:'Ocurrió un error inesperado. Probá de nuevo.'}}` logueando el error sin headers ni secretos.

- [ ] Step 1: Integration (invocando handlers exportados con `Request` armados): JSON inválido → 400 en español; producto inexistente → 404; error inesperado del servicio (mock) → 500 sin stack.
- [ ] Step 2: FAIL → implementar → PASS.
- [ ] Step 3: Manual: carrito vacío, sin órdenes, búsqueda sin resultados, `/comparar?ids=X`, `/productos/NOPE`, DB caída → `error.tsx` con "Reintentar"; app sin `GEMINI_API_KEY` → tienda ok, panel explica que el asistente está desactivado, búsqueda por keyword.
- [ ] Step 4: `npm run check`. Commit `fix: manejo uniforme de errores y estados vacíos` + push.

### Task 16: E2E Playwright

**Files:** Create `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/purchase.spec.ts`.

`global-setup`: migra + seed + `resetOperationalState` sobre `db-test`. `webServer`: `npm run build && npm run start` con `DATABASE_URL` de test y **sin** `GEMINI_API_KEY`.

- [ ] Step 1: `compra completa descuenta stock`: producto con stock conocido → leer disponibilidad mostrada → agregar 2 → carrito con total 2× precio → checkout (envío, Montevideo) → confirmar → "¡Compra confirmada!" y `MN-ORD-…` → `/ordenes` la lista → detalle del producto muestra disponibilidad − 2.
- [ ] Step 2: `no permite exceder stock`: cantidad N+1 en el carrito → error visible y total sin cambios.
- [ ] Step 3: `discontinuado no se puede agregar`: botón deshabilitado con "Discontinuado".
- [ ] Step 4: `npm run test:e2e` → PASS. Commit `test: e2e del flujo de compra` + push.

### Task 17: Docker de la app y reproducibilidad (RNF-01/02/03/07)

**Files:** Create `Dockerfile`, `scripts/docker-entrypoint.sh`, `.dockerignore`; Modify `docker-compose.yml` (servicio `app`: build, `env_file: .env`, `DATABASE_URL=postgres://postgres:postgres@db:5432/mercanova`, `depends_on: db: condition: service_healthy`, `ports: 3000:3000`), `README.md`.

- Dockerfile multi-stage `node:24-alpine`: deps → build (`next build` standalone; compilar `scripts/seed.ts` + migraciones a JS con `tsup` en esta etapa) → runner con `server.js`, `.next/static`, `public`, `drizzle/`, `data/`, `dist-scripts/`. Entrypoint: migrar → seed si `products` vacío → `exec node server.js`.
- `README.md` (español): requisitos, `cp .env.example .env`, key gratis, `docker compose up --build`, http://localhost:3000, reset (`docker compose down -v`), desarrollo y tests, estructura, links a spec/plan.

- [ ] Step 1: **Clone limpio**: `git clone` a un dir temporal, `.env` con la key, `docker compose up --build -d`, esperar healthy, `curl -sf localhost:3000` y `curl -sf localhost:3000/api/cart` OK; recorrer catálogo, chat, voz y compra en el browser; `docker compose down -v`.
- [ ] Step 2: `git grep -nE "AQ\.[A-Za-z0-9_-]{20}|AIza"` → sin resultados.
- [ ] Step 3: Commit `chore: dockerización completa y README` + push.

### Task 18: Revisión final

- [ ] Step 1: Correr la skill `code-review` del repo sobre todo el código; arreglar hallazgos críticos/altos (commit por fix).
- [ ] Step 2: Recorrer el checklist §16 de la letra (salvo PDF/video) y dejar evidencia por ítem en `docs/checklist-entrega.md` (test, comando o pantalla que lo prueba).
- [ ] Step 3: `npm run check && npm run test:integration && npm run test:e2e` verdes; commit `docs: checklist de entrega con evidencia` + push.
