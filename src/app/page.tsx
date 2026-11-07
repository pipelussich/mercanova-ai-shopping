import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { requestDb } from "@/server/request-db";
import { queryEmbedder } from "@/ai/embeddings";
import { listBrands, listProducts, type ProductFilters } from "@/server/catalog/catalog-service";
import { searchProducts } from "@/server/search/search-service";

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

async function SearchResults({ f }: { f: ReturnType<typeof parseFilters> & { q: string } }) {
  const { items, mode } = await searchProducts(
    await requestDb(),
    { ...f, query: f.q, limit: 20 },
    { embedQuery: queryEmbedder() },
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {items.length} resultados para «{f.q}»
        {mode === "keyword" && " · búsqueda por palabras clave (la búsqueda inteligente no está disponible ahora)"}
      </p>
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
  if (f.q) return <SearchResults f={{ ...f, q: f.q }} />;
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
