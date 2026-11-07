import Link from "next/link";
import { PackageSearch, Receipt } from "lucide-react";

export function SiteHeader({ cartSlot }: { cartSlot?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">
            M
          </span>
          MercaNova
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1.5 hover:text-foreground">
            <PackageSearch className="size-4" /> Catálogo
          </Link>
          <Link href="/ordenes" className="flex items-center gap-1.5 hover:text-foreground">
            <Receipt className="size-4" /> Mis órdenes
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">{cartSlot}</div>
      </div>
    </header>
  );
}
