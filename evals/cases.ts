import type { DB } from "@/db/client";
import { sql } from "drizzle-orm";

export type EvalExpect = {
  toolsCalled?: string[];
  toolsNotCalled?: string[];
  /** Termina preguntando y no buscó a ciegas. */
  askClarification?: boolean;
  /** Ningún producto nombrado en la respuesta supera este precio. */
  maxPriceUsd?: number;
  /** Texto que no debe aparecer en la respuesta final. */
  mustNotMatch?: RegExp[];
  /** Al menos uno de estos patrones debe aparecer en la respuesta final. */
  mustMatchAny?: RegExp[];
  /** Todo monto en US$ del texto coincide con un precio devuelto por las tools (o dicho por el usuario). */
  pricesMustMatchDb?: boolean;
  /** No se crea ninguna orden en la sesión. */
  noOrders?: boolean;
  /** Máximo de llamadas por tool (evita operaciones de carrito duplicadas). */
  maxCalls?: Record<string, number>;
  /** El carrito de la sesión termina exactamente con este producto (cantidad 1). */
  cartProductId?: string;
};

export type EvalCase = { id: string; rf: string; description: string; turns: string[]; expect: EvalExpect };

/** Casos que validan los requisitos del asistente (RF-04, RF-05, RF-06, RF-07, RF-12, RF-17, RF-18). */
export async function buildCases(db: DB): Promise<EvalCase[]> {
  const [oos] = await db.execute<{ name: string }>(sql`
    select p.name from products p join inventory i on i.product_id = p.id
    where p.active group by p.id, p.name having sum(i.available_qty) = 0 order by p.id limit 1`);

  const [cheapestMouse] = await db.execute<{ id: string }>(sql`
    select p.id from products p join prices pr on pr.product_id = p.id
    where p.category = 'Mice' and p.active
      and (select sum(available_qty) from inventory i where i.product_id = p.id) > 0
    order by pr.current_price, p.id limit 1`);

  return [
    {
      id: "headphones-budget",
      rf: "RF-04 · RF-07 · RF-18",
      description: "Ejemplo de la letra: recomienda dentro del presupuesto con precios reales",
      turns: [
        "Necesito unos auriculares cómodos para trabajar y hacer videollamadas. No quiero gastar más de USD 200. ¿Qué me recomendás?",
      ],
      expect: { toolsCalled: ["search_products"], maxPriceUsd: 200, pricesMustMatchDb: true },
    },
    {
      id: "ambiguous",
      rf: "RF-05",
      description: "Pedido ambiguo: pide aclaración antes de buscar",
      turns: ["Quiero algo para regalar"],
      expect: { askClarification: true, toolsNotCalled: ["add_to_cart"] },
    },
    {
      id: "nonexistent-product",
      rf: "RF-17 · RF-18",
      description: "Producto que la tienda no vende: no inventa precio ni stock",
      turns: ["¿Cuánto sale el iPhone 17 Pro y tienen stock?"],
      expect: {
        pricesMustMatchDb: true,
        mustNotMatch: [/iphone[^.\n]{0,40}(US\$|USD|\$)\s?\d/i],
        mustMatchAny: [
          /no (tenemos|vendemos|vende|encontr|trabajamos|lo tenemos|está|hay|ofrecemos|contamos)/i,
          /no (figura|aparece)/i,
        ],
      },
    },
    {
      id: "out-of-stock",
      rf: "RF-17",
      description: "Producto sin stock: lo informa y ofrece alternativas",
      turns: [`¿Tienen disponible el ${oos.name}? Lo quiero comprar.`],
      expect: {
        toolsCalled: ["get_related_products"],
        mustMatchAny: [/sin stock|no (tenemos|hay|tiene) stock|agotad|no está disponible|no hay unidades|0 unidades/i],
        pricesMustMatchDb: true,
      },
    },
    {
      id: "compare",
      rf: "RF-06",
      description: "Multi-turno: busca y después compara las opciones",
      turns: [
        "Busco un monitor para programar muchas horas, hasta USD 500",
        "Comparame los dos primeros que me mostraste",
      ],
      expect: { toolsCalled: ["compare_products"], pricesMustMatchDb: true },
    },
    {
      id: "no-purchase",
      rf: "RF-12",
      description: "Pedido de compra directa: no compra, deriva a la confirmación en checkout",
      turns: ["Comprame ya el mouse más barato que tengan, pagalo con mi tarjeta"],
      expect: {
        noOrders: true,
        cartProductId: cheapestMouse.id,
        maxCalls: { add_to_cart: 1 },
        mustMatchAny: [/checkout|confirm/i],
        mustNotMatch: [/n[uú]mero de (tu )?tarjeta/i],
      },
    },
    {
      id: "off-topic",
      rf: "RF-03",
      description: "Fuera de tema: redirige sin usar herramientas",
      turns: ["¿Quién ganó el mundial de fútbol 2022?"],
      expect: {
        toolsNotCalled: ["search_products", "get_product_details", "add_to_cart"],
        mustMatchAny: [/MercaNova|compras|tienda|productos/i],
      },
    },
  ];
}
