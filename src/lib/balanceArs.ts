/** Баланс в БД / API: строка из цифр (песо ARS, без копеек), пусто = не задан. */

export function stripBalanceToDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Нормализация перед сохранением: только цифры, без ведущих нулей; пусто разрешено. */
export function canonicalBalanceArs(s: string | null | undefined): string {
  const d = stripBalanceToDigits(s);
  if (!d) return "";
  const trimmed = d.replace(/^0+/, "");
  return trimmed.length ? trimmed : "0";
}

export function balancesArsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return canonicalBalanceArs(a) === canonicalBalanceArs(b);
}

/** Отображение: «1.000.000 ARS» или null, если суммы нет. */
export function formatBalanceArs(s: string | null | undefined): string | null {
  const n = canonicalBalanceArs(s);
  if (!n) return null;
  const withSep = n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withSep} ARS`;
}

export function formatBalanceArsDash(s: string | null | undefined): string {
  return formatBalanceArs(s) ?? "—";
}

/** Сумма балансов (только заданные, пустые не входят). */
export function sumBalancesArs(balances: Iterable<string | null | undefined>): bigint {
  let total = 0n;
  for (const b of balances) {
    const n = canonicalBalanceArs(b);
    if (n) total += BigInt(n);
  }
  return total;
}

export function formatBigIntBalanceArs(n: bigint): string {
  return formatBalanceArs(n.toString()) ?? "—";
}
