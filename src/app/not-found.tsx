import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">No encontramos lo que buscabas</h1>
      <p className="text-muted-foreground">El producto u orden no existe o no pertenece a tu sesión.</p>
      <Link href="/" className={buttonVariants()}>
        Volver al catálogo
      </Link>
    </div>
  );
}
