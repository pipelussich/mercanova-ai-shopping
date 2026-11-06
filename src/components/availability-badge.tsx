import { Badge } from "@/components/ui/badge";
import { stockLabelEs, type StockStatus } from "@/domain/stock";

export function AvailabilityBadge({
  status,
  availableQty,
  active = true,
}: {
  status: StockStatus;
  availableQty?: number;
  active?: boolean;
}) {
  if (!active) return <Badge variant="outline">Discontinuado</Badge>;
  const label = stockLabelEs(status);
  const qty = availableQty != null && status !== "Out of stock" ? ` · ${availableQty} u.` : "";
  if (status === "Out of stock") return <Badge variant="destructive">{label}</Badge>;
  if (status === "Low stock")
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        {label}
        {qty}
      </Badge>
    );
  return (
    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
      {label}
      {qty}
    </Badge>
  );
}
