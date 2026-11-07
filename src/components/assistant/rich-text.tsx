import Link from "next/link";
import { Fragment } from "react";

/**
 * Markdown mínimo para las respuestas del asistente: **negrita**, *itálica* y links internos [texto](/ruta).
 * Los links externos se muestran como texto (el asistente no debería mandar a sitios de afuera).
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
        if (link) {
          const [, label, href] = link;
          return /^\/(?![\/\\])/.test(href) ? (
            <Link key={i} href={href} className="font-medium underline">
              {label}
            </Link>
          ) : (
            <Fragment key={i}>{label}</Fragment>
          );
        }
        if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
