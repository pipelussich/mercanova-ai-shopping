import Link from "next/link";
import { Star } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { categoryLabel } from "@/domain/categories";
import type { ProductSummary } from "@/server/catalog/catalog-service";
import { AvailabilityBadge } from "./availability-badge";
import { CompareToggle } from "./compare-toggle";
import { Price } from "./price";

export function ProductCard({ product, actions }: { product: ProductSummary; actions?: React.ReactNode }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0">
      <Link href={`/productos/${product.id}`} className="block bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- imágenes placeholder externas del dataset */}
        <img
          src={product.imageUrl ?? ""}
          alt={product.name}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      </Link>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {categoryLabel(product.category)} · {product.brand}
          </span>
          {product.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
        <Link href={`/productos/${product.id}`} className="font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.shortDescription}</p>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Price
            priceCents={product.priceCents}
            listPriceCents={product.listPriceCents}
            discountPercent={product.discountPercent}
          />
          <AvailabilityBadge status={product.stockStatus} availableQty={product.availableQty} active={product.active} />
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {actions}
        <CompareToggle id={product.id} name={product.name} />
      </CardFooter>
    </Card>
  );
}
