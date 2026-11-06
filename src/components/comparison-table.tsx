import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUSD } from "@/domain/money";
import { stockLabelEs, type StockStatus } from "@/domain/stock";

export type ComparisonProduct = {
  id: string;
  name: string;
  brand: string;
  priceCents: number;
  availableQty: number;
  stockStatus: StockStatus;
  rating: number | null;
  warrantyMonths: number | null;
  active?: boolean;
};

export function ComparisonTable({
  products,
  rows,
}: {
  products: ComparisonProduct[];
  rows: { group: string; name: string; values: (string | null)[] }[];
}) {
  const fixed: { label: string; values: React.ReactNode[] }[] = [
    { label: "Marca", values: products.map((p) => p.brand) },
    { label: "Precio", values: products.map((p) => <strong key={p.id}>{formatUSD(p.priceCents)}</strong>) },
    {
      label: "Disponibilidad",
      values: products.map((p) =>
        p.active === false ? "Discontinuado" : `${stockLabelEs(p.stockStatus)} (${p.availableQty} u.)`,
      ),
    },
    { label: "Rating", values: products.map((p) => (p.rating != null ? `${p.rating.toFixed(1)} / 5` : "—")) },
    { label: "Garantía", values: products.map((p) => (p.warrantyMonths ? `${p.warrantyMonths} meses` : "—")) },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Característica</TableHead>
            {products.map((p) => (
              <TableHead key={p.id} className="min-w-40 whitespace-normal">
                <Link href={`/productos/${p.id}`} className="font-medium text-foreground hover:underline">
                  {p.name}
                </Link>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixed.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="font-medium">{r.label}</TableCell>
              {r.values.map((v, i) => (
                <TableCell key={i}>{v}</TableCell>
              ))}
            </TableRow>
          ))}
          {rows.map((r) => {
            const differs = new Set(r.values.map((v) => v ?? "—")).size > 1;
            return (
              <TableRow key={`${r.group}-${r.name}`}>
                <TableCell className="font-medium">
                  {r.name}
                  <span className="block text-xs font-normal text-muted-foreground">{r.group}</span>
                </TableCell>
                {r.values.map((v, i) => (
                  <TableCell key={i} className={differs ? "bg-amber-50/60" : undefined}>
                    {v ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
