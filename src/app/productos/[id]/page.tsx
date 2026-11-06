import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ShieldCheck, Star, Undo2 } from "lucide-react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { CompareToggle } from "@/components/compare-toggle";
import { Price } from "@/components/price";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/db/client";
import { categoryLabel, RELATION_LABELS_ES } from "@/domain/categories";
import { stockLabelEs, stockStatus } from "@/domain/stock";
import { getProduct, type ProductDetail } from "@/server/catalog/catalog-service";

export default function ProductPage({ params }: PageProps<"/productos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(getDb(), decodeURIComponent(id));
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}

function ProductDetailView({ product: p }: { product: ProductDetail }) {
  const groups = Map.groupBy(p.specs, (s) => s.group);
  const related = Map.groupBy(p.related, (r) => r.relationType);
  return (
    <div className="flex flex-col gap-8">
      <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen placeholder externa */}
        <img src={p.imageUrl ?? ""} alt={p.name} className="w-full rounded-xl border bg-muted object-cover" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{categoryLabel(p.category)}</span>·<span>{p.subcategory}</span>·<span>{p.brand}</span>
            {p.rating != null && (
              <span className="flex items-center gap-1">
                · <Star className="size-3.5 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)} ({p.reviewCount}{" "}
                reseñas)
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
          <p className="text-muted-foreground">{p.shortDescription}</p>
          <Price priceCents={p.priceCents} listPriceCents={p.listPriceCents} discountPercent={p.discountPercent} size="lg" />
          <div>
            <AvailabilityBadge status={p.stockStatus} availableQty={p.availableQty} active={p.active} />
          </div>
          <div className="flex flex-wrap gap-2" data-slot="product-actions">
            <AddToCartButton productId={p.id} productName={p.name} active={p.active} availableQty={p.availableQty} size="lg" />
            <CompareToggle id={p.id} name={p.name} size="default" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {p.warrantyMonths != null && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-4" /> Garantía {p.warrantyMonths} meses
              </span>
            )}
            {p.returnDays != null && (
              <span className="flex items-center gap-1">
                <Undo2 className="size-4" /> Devolución {p.returnDays} días
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{p.description}</p>
          <div className="flex flex-col gap-2 text-sm">
            {p.recommendedFor.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="font-medium">Recomendado para:</span>
                {p.recommendedFor.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
            {p.notRecommendedFor.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="font-medium">No recomendado para:</span>
                {p.notRecommendedFor.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Especificaciones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {[...groups.entries()].map(([group, specs]) => (
              <div key={group}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group}</h3>
                <dl className="flex flex-col gap-1 text-sm">
                  {specs.map((s) => (
                    <div key={s.name} className="flex justify-between gap-4 border-b border-dashed py-1">
                      <dt>{s.name}</dt>
                      <dd className="text-right font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock por depósito</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {p.stockByWarehouse.map((w) => (
                <li key={w.warehouseId} className="flex items-center justify-between gap-2">
                  <span>
                    {w.warehouseName}
                    <span className="block text-xs text-muted-foreground">{w.city}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    {w.availableQty} u.
                    <span className="block text-xs text-muted-foreground">
                      {stockLabelEs(stockStatus(w.availableQty))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {[...related.entries()].map(([type, items]) => (
        <section key={type} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{RELATION_LABELS_ES[type] ?? type}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.slice(0, 4).map((r) => (
              <ProductCard key={r.product.id} product={r.product} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
