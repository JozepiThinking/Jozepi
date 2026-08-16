export type ReportPeriod = "today" | "week" | "month" | "lastMonth" | "allTime" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

const shortMonthLabels = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function startOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function endOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getWeekRange(date: Date): DateRange {
  const start = startOfDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);

  const end = endOfDay(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}

// Used as the lower bound for the "Período Total" (all time) shortcut —
// far enough in the past to include every record without needing a real
// query for the earliest transaction date.
const EARLIEST_POSSIBLE_DATE = new Date(2000, 0, 1);

export function getReportRange(
  period: ReportPeriod,
  customStart: string,
  customEnd: string,
  baseDate = new Date()
): DateRange {
  if (period === "today") {
    return { start: startOfDay(baseDate), end: endOfDay(baseDate) };
  }

  if (period === "week") {
    return getWeekRange(baseDate);
  }

  if (period === "lastMonth") {
    return { start: startOfLastMonth(baseDate), end: endOfLastMonth(baseDate) };
  }

  if (period === "allTime") {
    return { start: EARLIEST_POSSIBLE_DATE, end: endOfDay(baseDate) };
  }

  if (period === "custom") {
    return {
      start: customStart ? startOfDay(parseLocalDate(customStart)) : startOfDay(baseDate),
      end: customEnd ? endOfDay(parseLocalDate(customEnd)) : endOfDay(baseDate),
    };
  }

  return { start: startOfMonth(baseDate), end: endOfMonth(baseDate) };
}

export function isDateInRange(date: string, range: DateRange) {
  if (!date) return false;
  const parsed = parseLocalDate(date);
  return parsed >= range.start && parsed <= range.end;
}

export function formatShortDate(date: string) {
  const parsed = parseLocalDate(date);
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${day}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
}

export function formatDayMonth(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(date: Date) {
  return `${shortMonthLabels[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
}

/**
 * Builds evenly spaced date buckets across a range, choosing a sensible
 * granularity (daily, weekly or monthly) based on the total span.
 */
export function buildDateBuckets(range: DateRange): DateBucket[] {
  const spanDays = Math.max(
    1,
    Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1
  );

  if (spanDays <= 31) {
    const buckets: DateBucket[] = [];
    let cursor = startOfDay(range.start);
    while (cursor <= range.end) {
      buckets.push({
        key: dateKey(cursor),
        label: formatDayMonth(cursor),
        start: startOfDay(cursor),
        end: endOfDay(cursor),
      });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  if (spanDays <= 120) {
    const buckets: DateBucket[] = [];
    let cursor = startOfDay(range.start);
    let weekNum = 1;
    while (cursor <= range.end) {
      const weekEnd = addDays(cursor, 6);
      const boundedEnd = weekEnd > range.end ? range.end : weekEnd;
      buckets.push({
        key: dateKey(cursor),
        label: `Sem ${weekNum}`,
        start: startOfDay(cursor),
        end: endOfDay(boundedEnd),
      });
      cursor = addDays(cursor, 7);
      weekNum += 1;
    }
    return buckets;
  }

  const buckets: DateBucket[] = [];
  let cursor = startOfMonth(range.start);
  while (cursor <= range.end) {
    const monthEnd = endOfMonth(cursor);
    buckets.push({
      key: dateKey(cursor),
      label: getMonthLabel(cursor),
      start: cursor < range.start ? range.start : cursor,
      end: monthEnd > range.end ? range.end : monthEnd,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
}

export function toCurrencyNumber(value: number | string | null | undefined) {
  return Number(value) || 0;
}
