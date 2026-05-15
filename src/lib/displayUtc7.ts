/** Часовой пояс для отображения всех дат/времени в интерфейсе (UTC+7). */
const TZ_UTC_PLUS_7 = "Asia/Bangkok";

/**
 * Разбор метки времени из SQLite `datetime('now')` — считаем её UTC в виде `YYYY-MM-DD HH:MM:SS`.
 */
export function parseSqliteUtcDatetime(s: string): Date | null {
  const t = s.trim();
  const full = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );
  if (full) {
    const [, Y, Mo, D, h, mi, se] = full;
    return new Date(
      Date.UTC(
        Number(Y),
        Number(Mo) - 1,
        Number(D),
        Number(h),
        Number(mi),
        Number(se)
      )
    );
  }
  const dayOnly = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    return new Date(
      Date.UTC(
        Number(dayOnly[1]),
        Number(dayOnly[2]) - 1,
        Number(dayOnly[3]),
        0,
        0,
        0
      )
    );
  }
  return null;
}

/** «14 мая 2026» без « г.» после года — через части, не через цельную строку ru-RU. */
function formatRuDateLongUtc7(d: Date): string {
  const dateFmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ_UTC_PLUS_7,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dp = dateFmt.formatToParts(d);
  const day = dp.find((p) => p.type === "day")?.value ?? "";
  const month = dp.find((p) => p.type === "month")?.value ?? "";
  const year = dp.find((p) => p.type === "year")?.value ?? "";
  return [day, month, year].filter(Boolean).join(" ");
}

function formatRuTimeHmsUtc7(d: Date): string {
  const timeFmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ_UTC_PLUS_7,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const tp = timeFmt.formatToParts(d);
  const hour = tp.find((p) => p.type === "hour")?.value ?? "";
  const minute = tp.find((p) => p.type === "minute")?.value ?? "";
  const second = tp.find((p) => p.type === "second")?.value;
  if (!hour || !minute) return timeFmt.format(d);
  return second != null && second !== "" ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
}

/** Дата и время в UTC+7: «14 мая 2026 | 16:34:09 (UTC+7)». */
export function formatSqliteUtcAsRuDateTimeUtc7(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const d = parseSqliteUtcDatetime(s);
  if (!d || Number.isNaN(d.getTime())) return s.trim();
  return `${formatRuDateLongUtc7(d)} | ${formatRuTimeHmsUtc7(d)} (UTC+7)`;
}

/** Компактно для подписей в ЛК: «14 мая 2026 | 16:34:09», без « г.». */
export function formatSqliteUtcAsRuDateTimeAuditStrip(s: string | null | undefined): string {
  if (!s?.trim()) return "—";
  const d = parseSqliteUtcDatetime(s);
  if (!d || Number.isNaN(d.getTime())) return s.trim();
  return `${formatRuDateLongUtc7(d)} | ${formatRuTimeHmsUtc7(d)}`;
}

/**
 * Календарная дата `YYYY-MM-DD` (лимит/отлега) — «день месяц год» в UTC+7
 * (полдень UTC, чтобы не сместить календарный день).
 */
export function formatYmdRuCalendarUtc7(ymd: string): string {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd.trim();
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  );
  return formatRuDateLongUtc7(d);
}
