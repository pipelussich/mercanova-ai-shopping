"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Error inesperado en una página (p.ej. la base no responde): mensaje claro y opción de reintentar (RNF-04). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page] error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-muted-foreground">
        No pudimos cargar esta página. Puede ser un problema momentáneo: probá de nuevo en unos segundos.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ir al catálogo
        </Link>
      </div>
    </div>
  );
}
