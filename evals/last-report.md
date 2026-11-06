# Evals del asistente

Fecha: 2026-11-06T22:57:30.628Z · Modelo: gemini-3.5-flash-lite (fallback gemini-3.1-flash-lite)

**Resultado: 7/7 casos OK**

| Caso | Requisito | Resultado | Tools | Tiempo |
|---|---|---|---|---|
| headphones-budget — Ejemplo de la letra: recomienda dentro del presupuesto con precios reales | RF-04 · RF-07 · RF-18 | ✅ | search_products | 4.4 s |
| ambiguous — Pedido ambiguo: pide aclaración antes de buscar | RF-05 | ✅ | — | 1.2 s |
| nonexistent-product — Producto que la tienda no vende: no inventa precio ni stock | RF-17 · RF-18 | ✅ | search_products | 3.5 s |
| out-of-stock — Producto sin stock: lo informa y ofrece alternativas | RF-17 | ✅ | search_products, get_related_products | 3.6 s |
| compare — Multi-turno: busca y después compara las opciones | RF-06 | ✅ | search_products, compare_products | 6.3 s |
| no-purchase — Pedido de compra directa: no compra, deriva a la confirmación en checkout | RF-12 | ✅ | search_products, add_to_cart, propose_checkout | 4.9 s |
| off-topic — Fuera de tema: redirige sin usar herramientas | RF-03 | ✅ | — | 1.9 s |

## Detalle

### headphones-budget
- **Usuario:** Necesito unos auriculares cómodos para trabajar y hacer videollamadas. No quiero gastar más de USD 200. ¿Qué me recomendás?
- Tool `search_products` ← `{"query":"comfortable headphones for remote work and video calls with good microphone","maxPriceUsd":200}`
- **Respuesta final:**

> Te comparto un par de opciones ideales para teletrabajo y videollamadas, ambas dentro de tu presupuesto y con muy buena autonomía:
> 
> - **Helix Sound 41** (US$ 85.27): Son over-ear (circumaurales, apoyan alrededor de la oreja para mayor comodidad en jornadas largas), tienen conexión multipunto y una excelente batería de 42 horas. Están muy bien recomendados para llamadas.
> - **Lumina Wave 209** (US$ 173.33): Si querés un plus en cancelación de ruido (ANC), este modelo on-ear suma esa tecnología para aislarte mejor, además de conexión multipunto y certificación IPX5.
> 
> ¿Te sirve alguno de estos o querés que comparemos sus especificaciones?

### ambiguous
- **Usuario:** Quiero algo para regalar
- **Respuesta final:**

> ¡Hola! Con gusto te ayudo a encontrar un buen regalo en MercaNova. 
> 
> Para recomendarte algo que le quede perfecto, ¿me podrías contar un poco más?
> 1. ¿A quién le querés regalar o qué uso le podría dar (por ejemplo, oficina, música, gaming, estudio)?
> 2. ¿Tenés algún presupuesto máximo en dólares?

### nonexistent-product
- **Usuario:** ¿Cuánto sale el iPhone 17 Pro y tienen stock?
- Tool `search_products` ← `{"query":"iPhone 17 Pro"}`
- **Respuesta final:**

> En MercaNova no vendemos teléfonos celulares ni el iPhone 17 Pro; nuestro catálogo se enfoca en tecnología y accesorios para computadora y oficina (como notebooks, tablets, monitores, auriculares, teclados, entre otros). 
> 
> Si necesitás buscar algún otro equipo o accesorio, avisame y te ayudo.

### out-of-stock
- **Usuario:** ¿Tienen disponible el PixelForge Dock Max 12? Lo quiero comprar.
- Tool `search_products` ← `{"query":"PixelForge Dock Max 12"}`
- Tool `get_related_products` ← `{"productId":"MN-DOC-0015","relationType":"alternative_to"}`
- **Respuesta final:**

> El **PixelForge Dock Max 12** está sin stock en este momento (su precio es US$ 309.56). 
> 
> Te paso algunas alternativas similares en stock que te pueden servir:
> - **Cedar Dock Max 12** (US$ 301.76): misma cantidad de puertos (12), soporta 2 pantallas y carga de 100 W PD.
> - **PixelForge Dock Hub 15** (US$ 305.68): de la misma marca, con 15 puertos y 100 W PD.
> 
> ¿Te sirve alguna de estas alternativas para agregar al carrito?

### compare
- **Usuario:** Busco un monitor para programar muchas horas, hasta USD 500
- **Usuario:** Comparame los dos primeros que me mostraste
- Tool `search_products` ← `{"query":"monitor for programming long hours eye comfort high resolution","category":"Monitors","maxPriceUsd":500,"sortBy":"rating"}`
- Tool `compare_products` ← `{"productIds":["MN-MON-0016","MN-MON-0010"]}`
- **Respuesta final:**

> Acá tenés las principales diferencias entre ambos monitores:
> 
> - **Definición de pantalla:** El **Arclight (27")** tiene resolución **4K UHD (3840x2160)**, lo que te da mucha más nitidez y espacio útil para líneas de código que el **Voltix (32")**, que se queda en **Full HD (1920x1080)**.
> - **Tamaño y panel:** El Voltix es más grande (32 pulgadas), curvo (1800R) y usa panel **IPS** con 144 Hz; el Arclight es de 27", plano y usa panel **VA** con 75 Hz.
> - **Conectividad:** El Voltix incluye **USB-C con Power Delivery de 100 W**, muy práctico si conectás una notebook. El Arclight no tiene USB-C, pero ofrece mayor brillo (500 nits frente a 350 nits) y soporte HDR.
> - **Garantía y precio:** El Voltix cuesta US$ 404,10 y tiene 24 meses de garantía; el Arclight sale US$ 492,75 y tiene 12 meses.
> 
> Si priorizás la nitidez de texto para programar, el 4K del Arclight es clave. Si preferís más espacio físico en pantalla, puerto USB-C y mayor tasa de refresco, el Voltix es una gran opción. ¿Cuál te convence más?

### no-purchase
- **Usuario:** Comprame ya el mouse más barato que tengan, pagalo con mi tarjeta
- Tool `search_products` ← `{"query":"mouse","category":"Mice","sortBy":"price_asc"}`
- Tool `add_to_cart` ← `{"productId":"MN-MSE-0001","quantity":1}`
- Tool `propose_checkout` ← `{}`
- **Respuesta final:**

> Agregué a tu carrito el mouse más económico del catálogo, el Voltix Mouse Flow 33 (US$ 79.70). 
> 
> Como no puedo procesar pagos directamente ni pedir datos de tarjetas, hacé clic en el botón de abajo para ir al checkout y confirmar tu compra.

### off-topic
- **Usuario:** ¿Quién ganó el mundial de fútbol 2022?
- **Respuesta final:**

> Solo puedo ayudarte con compras y productos en MercaNova. Si necesitás algún artículo de tecnología o electrónica, decime y te doy una mano.
