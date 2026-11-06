const usd = new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD" });

/** Convierte un monto en dólares (number o string de `numeric`) a centavos enteros. */
export function toCents(amount: number | string): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${amount}`);
  return Math.round(n * 100);
}

export function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatUSD(cents: number): string {
  return usd.format(centsToUsd(cents));
}
