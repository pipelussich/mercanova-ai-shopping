import Link from "next/link";
import { Suspense } from "react";
import { ComparisonTable } from "@/components/comparison-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requestDb } from "@/server/request-db";
import { isDomainError } from "@/domain/errors";
import { compareProducts } from "@/server/catalog/catalog-service";

export default function ComparePage({ searchParams }: PageProps<"/comparar">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Comparar productos</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Comparison({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = await compareProducts(await requestDb(), ids).catch((err: unknown) => {
    if (isDomainError(err)) return { error: err.message };
    throw err;
  });
  if ("error" in result)
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <p className="mb-3">{result.error}</p>
        <Link href="/" className="text-sm underline">
          Volver al catálogo y elegir productos con «Comparar»
        </Link>
      </div>
    );
  return (
    <>
      <p className="text-sm text-muted-foreground">Las filas resaltadas son las que difieren entre productos.</p>
      <ComparisonTable products={result.products} rows={result.rows} />
    </>
  );
}
