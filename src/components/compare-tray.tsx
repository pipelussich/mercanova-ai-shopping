"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCompare } from "./compare-context";

export function CompareTray() {
  const { items, toggle, clear } = useCompare();
  const pathname = usePathname();
  if (items.length === 0 || pathname.startsWith("/comparar")) return null;
  const href = `/comparar?ids=${items.map((i) => i.id).join(",")}`;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-lg">
      <GitCompareArrows className="size-4 text-muted-foreground" />
      <div className="flex max-w-[50vw] gap-1 overflow-x-auto">
        {items.map((i) => (
          <span
            key={i.id}
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {i.name}
            <button aria-label={`Quitar ${i.name}`} onClick={() => toggle(i)}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <Button size="sm" variant="ghost" onClick={clear}>
        Limpiar
      </Button>
      {items.length < 2 ? (
        <span className="text-xs text-muted-foreground">Elegí al menos 2</span>
      ) : (
        <Link href={href} className={buttonVariants({ size: "sm" })}>
          Comparar ({items.length})
        </Link>
      )}
    </div>
  );
}
