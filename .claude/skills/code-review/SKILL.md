---
name: code-review
description: Use when reviewing a diff, a commit range or the whole MercaNova codebase before committing or delivering — checks the change against the assignment requirements (RF/RNF), the hard rules in AGENTS.md, layer boundaries, error handling and secrets. Triggers on "revisá el código", "code review", "revisá este diff", "está listo para entregar?".
---

# Code review de MercaNova

Objetivo: encontrar problemas reales que afecten al usuario o a la nota, no estilo.

## Cómo hacerlo

1. Definí el alcance: `git diff <base>..HEAD --stat` y luego el diff completo de los archivos relevantes.
2. Leé el spec (`docs/superpowers/specs/…-design.md`) para la parte que toca el cambio.
3. Recorré el checklist. Para cada hallazgo, verificá leyendo el código (y si podés, con un test) antes de reportarlo.

## Checklist

**Reglas duras (AGENTS.md) — cualquier violación es Crítica**
- [ ] Ninguna tool del asistente crea órdenes ni llama a `placeOrder`.
- [ ] Precio/stock/specs mostrados vienen de la DB (no de texto del modelo ni de constantes).
- [ ] Ningún secreto en el diff (`git grep -nE "AQ\.[A-Za-z0-9_-]{20}|AIza"` vacío).
- [ ] Cambios de inventario sólo dentro de transacción con lock; imposible stock negativo.

**Requisitos de la letra**
- [ ] RF-10: no se puede comprar más que lo disponible (carrito y confirmación).
- [ ] RF-12: la compra exige confirmación explícita en la UI; doble click no duplica (idempotency key).
- [ ] RF-15: la compra descuenta stock y recalcula estado por depósito.
- [ ] RF-05/RF-18: el prompt pide aclaraciones y prohíbe inventar; hay eval que lo cubre.
- [ ] RF-17 / RNF-04: errores previsibles devuelven mensaje claro en español y no dejan estado inconsistente.

**Arquitectura**
- [ ] `src/domain` no importa de `server`, `ai`, `app` ni `db`.
- [ ] Route handlers delgados: validan input (zod) y delegan en servicios.
- [ ] Server Components con DB/cookies/searchParams dentro de `<Suspense>` (Next 16 `cacheComponents`).
- [ ] Plata en centavos enteros; nada de floats para totales.

**Tests**
- [ ] Cada comportamiento nuevo tiene un test que falla sin el cambio.
- [ ] Los tests afirman resultados observables, no llamadas a mocks.
- [ ] `npm run check` y, si aplica, `npm run test:integration` en verde.

## Formato de salida

Hallazgos ordenados por severidad, cada uno con `archivo:línea`, qué pasa, escenario concreto que lo dispara y fix sugerido:

- **Crítico** — viola una regla dura o rompe el flujo de compra.
- **Importante** — un usuario razonable lo nota (error confuso, dato incorrecto, caso límite sin manejar).
- **Menor** — mantenibilidad o prolijidad.

Si no encontrás nada importante, decilo explícitamente y listá qué revisaste.
