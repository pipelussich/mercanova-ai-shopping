import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { requestDb } from "@/server/request-db";
import { queryEmbedder } from "@/ai/embeddings";
import { listBrands, listProducts, type ProductFilters } from "@/server/catalog/catalog-service";
import { searchProducts, type SearchQuery, type SortBy } from "@/server/search/search-service";
import { toCatalogFilters, understandQuery } from "@/ai/query-understanding";
import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/domain/categories";
import { formatUSD } from "@/domain/money";
import { hasAI } from "@/env";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function parseFilters(sp: SP): ProductFilters & { page: number; q?: string } {
  const max = Number(one(sp.max));
  return {
    q: one(sp.q)?.trim() || undefined,
    category: one(sp.category) || undefined,
    brand: one(sp.brand) || undefined,
    maxPriceCents: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : undefined,
    inStockOnly: one(sp.stock) === "1",
    includeInactive: one(sp.inactive) === "1",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
}

export default function CatalogPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="text-sm text-muted-foreground">
          Buscá con tus palabras o abrí el asistente para que te recomiende qué comprar.
        </p>
      </section>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <Filters />
      </Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Filters() {
  const brands = await listBrands(await requestDb());
  return <CatalogFilters brands={brands} />;
}

/** Etiquetas de lo que el modelo entendió de la búsqueda, para que la persona vea qué filtros se aplicaron. */
function understoodChips(q: SearchQuery & { sortBy?: SortBy }): string[] {
  const chips: string[] = [];
  if (q.category) chips.push(categoryLabel(q.category));
  if (q.brand) chips.push(q.brand);
  if (q.minPriceCents != null) chips.push(`desde ${formatUSD(q.minPriceCents)}`);
  if (q.maxPriceCents != null) chips.push(`hasta ${formatUSD(q.maxPriceCents)}`);
  if (q.inStockOnly) chips.push("con stock");
  if (q.sortBy === "price_asc") chips.push("más baratos primero");
  if (q.sortBy === "price_desc") chips.push("más caros primero");
  if (q.sortBy === "rating") chips.push("mejor puntuados primero");
  return chips;
}

async function SearchResults({ f, literal }: { f: ReturnType<typeof parseFilters> & { q: string }; literal: boolean }) {
  const db = await requestDb();
  let query: SearchQuery & { sortBy?: SortBy } = { ...f, query: f.q };
  let chips: string[] = [];
  // Structured output: el modelo pasa el texto a filtros. Lo que la persona eligió a mano en los filtros manda.
  const understood = !literal && hasAI() ? await understandQuery(f.q) : null;
  if (understood) {
    const inferred = toCatalogFilters(understood, await listBrands(db));
    query = {
      ...inferred,
      category: f.category ?? inferred.category,
      brand: f.brand ?? inferred.brand,
      maxPriceCents: f.maxPriceCents ?? inferred.maxPriceCents,
      inStockOnly: f.inStockOnly || inferred.inStockOnly,
      includeInactive: f.includeInactive,
    };
    chips = understoodChips(inferred);
  }
  const { items, mode } = await searchProducts(db, { ...query, limit: 20 }, { embedQuery: queryEmbedder() });
  const literalHref = `/?${new URLSearchParams({ q: f.q, literal: "1" }).toString()}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {items.length} resultados para «{f.q}»
        {mode === "keyword" && " · búsqueda por palabras clave (la búsqueda inteligente no está disponible ahora)"}
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="understood-filters">
          <span className="text-muted-foreground">Entendimos</span>
          {chips.map((c) => (
            <Badge key={c} variant="secondary">
              {c}
            </Badge>
          ))}
          <Link href={literalHref} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            buscar el texto tal cual
          </Link>
        </div>
      )}
      {items.length === 0 ? (
        <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
          No encontramos productos para esa búsqueda. Probá describirlo de otra forma o preguntale al asistente.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  if (f.q) return <SearchResults f={{ ...f, q: f.q }} literal={one(sp.literal) === "1"} />;
  const { items, total } = await listProducts(await requestDb(), f);
  const pages = Math.max(1, Math.ceil(total / 24));

  if (items.length === 0)
    return (
      <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
        No encontramos productos con esos filtros. Probá sacando alguno.
      </div>
    );

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") next.set(k, v);
    next.set("page", String(p));
    return `/?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{total} productos</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {f.page > 1 && (
            <Link href={pageHref(f.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Anterior
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Página {f.page} de {pages}
          </span>
          {f.page < pages && (
            <Link href={pageHref(f.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-80" />
      ))}
    </div>
  );
}
