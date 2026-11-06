import { formatUSD } from "@/domain/money";

export function Price({
  priceCents,
  listPriceCents,
  discountPercent,
  size = "md",
}: {
  priceCents: number;
  listPriceCents?: number;
  discountPercent?: number;
  size?: "sm" | "md" | "lg";
}) {
  const main = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`${main} font-semibold tabular-nums`}>{formatUSD(priceCents)}</span>
      {discountPercent && listPriceCents && listPriceCents > priceCents ? (
        <>
          <span className="text-sm text-muted-foreground line-through tabular-nums">{formatUSD(listPriceCents)}</span>
          <span className="text-xs font-medium text-emerald-700">-{discountPercent}%</span>
        </>
      ) : null}
    </div>
  );
}
