export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export interface TimezoneRegion {
  value: string;
  label: string;
  description: string;
}

export const TIMEZONE_REGIONS: TimezoneRegion[] = [
  {
    value: "America/Sao_Paulo",
    label: "Brasília",
    description: "SP, RJ, MG, Sul, Nordeste, Centro-Oeste (UTC−3)",
  },
  {
    value: "America/Manaus",
    label: "Manaus",
    description: "Amazonas (UTC−4)",
  },
  {
    value: "America/Cuiaba",
    label: "Cuiabá",
    description: "Mato Grosso e Mato Grosso do Sul (UTC−4)",
  },
  {
    value: "America/Porto_Velho",
    label: "Porto Velho",
    description: "Rondônia (UTC−4)",
  },
  {
    value: "America/Boa_Vista",
    label: "Boa Vista",
    description: "Roraima (UTC−4)",
  },
  {
    value: "America/Rio_Branco",
    label: "Rio Branco",
    description: "Acre (UTC−5)",
  },
  {
    value: "America/Noronha",
    label: "Fernando de Noronha",
    description: "UTC−2",
  },
  {
    value: "Europe/Lisbon",
    label: "Lisboa",
    description: "Portugal",
  },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "Buenos Aires",
    description: "Argentina",
  },
  {
    value: "America/Asuncion",
    label: "Assunção",
    description: "Paraguai",
  },
  {
    value: "America/Montevideo",
    label: "Montevidéu",
    description: "Uruguai",
  },
  {
    value: "America/Santiago",
    label: "Santiago",
    description: "Chile",
  },
  {
    value: "America/New_York",
    label: "Nova York / Miami",
    description: "Costa leste dos EUA",
  },
];

export function isMissingTimezoneError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return (
    message.includes("timezone") &&
    (message.includes("schema cache") ||
      message.includes("Could not find") ||
      message.includes("column"))
  );
}

export function resolveTimeZone(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getDeviceTimeZone() {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getTimezoneRegion(value: string | null | undefined) {
  const timeZone = resolveTimeZone(value);
  return (
    TIMEZONE_REGIONS.find((region) => region.value === timeZone) ?? {
      value: timeZone,
      label: timeZone.replace(/_/g, " "),
      description: "Fuso do dispositivo",
    }
  );
}

export function getTimezoneDropdownOptions(extraValue?: string | null) {
  const extra = extraValue ? resolveTimeZone(extraValue) : null;
  const options = TIMEZONE_REGIONS.map((region) => ({
    value: region.value,
    label: `${region.label} — ${region.description}`,
  }));

  if (extra && !options.some((option) => option.value === extra)) {
    const region = getTimezoneRegion(extra);
    options.unshift({
      value: region.value,
      label: `${region.label} — ${region.description}`,
    });
  }

  return options;
}

interface ZonedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function getZonedDateTime(
  date: Date,
  timeZone: string | null | undefined
): ZonedDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateKeyInTimeZone(
  date: Date,
  timeZone: string | null | undefined
) {
  const zoned = getZonedDateTime(date, timeZone);
  return `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)}`;
}

export function addDaysToDateKey(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + amount);

  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

export function monthRangeKeys(
  date: Date,
  timeZone: string | null | undefined
) {
  const zoned = getZonedDateTime(date, timeZone);
  const lastDay = new Date(zoned.year, zoned.month, 0).getDate();

  return {
    start: `${zoned.year}-${pad(zoned.month)}-01`,
    end: `${zoned.year}-${pad(zoned.month)}-${pad(lastDay)}`,
  };
}

export function addMonthsToYearMonth(year: number, month: number, amount: number) {
  const index = year * 12 + (month - 1) + amount;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

/**
 * Date whose local getters match the civil clock in `timeZone`.
 * Use for calendar "today" and naive HH:mm comparisons. Do not call
 * toISOString() on this value — keep a real `new Date()` for UTC timestamps.
 */
export function wallClockInTimeZone(
  date: Date,
  timeZone: string | null | undefined
) {
  const zoned = getZonedDateTime(date, timeZone);
  return new Date(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    0,
    0
  );
}

export function formatUtcOffset(
  timeZone: string | null | undefined,
  date = new Date()
) {
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!tzName) return "";
  return tzName.replace("GMT", "UTC");
}

export function formatZonedDateTime(
  date: Date,
  timeZone: string | null | undefined
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: resolveTimeZone(timeZone),
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatZonedDate(
  date: Date,
  timeZone: string | null | undefined
) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: resolveTimeZone(timeZone),
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!weekday || !day || !month || !year) return formatter.format(date);

  const capitalize = (value: string) =>
    value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);

  return `${capitalize(weekday)}, ${day} de ${capitalize(month)} de ${year}`;
}

export function getZonedHour(date: Date, timeZone: string | null | undefined) {
  return getZonedDateTime(date, timeZone).hour;
}

export function formatGeneratedAt(
  date: Date,
  timeZone: string | null | undefined
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: resolveTimeZone(timeZone),
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
