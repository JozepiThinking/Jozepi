export type WidgetId =
  | "revenue"
  | "clients"
  | "services"
  | "agenda"
  | "cashflow"
  | "nextToday"
  | "lowStock"
  | "chart";

/** Fixed block sizes — like phone widget presets, not free resize. */
export type WidgetSize = "sm" | "md" | "lg";

export interface WidgetLayoutItem {
  id: WidgetId;
  size: WidgetSize;
}

export const DASHBOARD_LAYOUT_STORAGE_KEY = "auto-estetica-dashboard-layout";
export const DASHBOARD_LAYOUT_VERSION = 1;

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  sm: "P",
  md: "M",
  lg: "G",
};

export const WIDGET_SIZE_ORDER: WidgetSize[] = ["sm", "md", "lg"];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  revenue: "Faturamento",
  clients: "Clientes",
  services: "Serviços",
  agenda: "Agenda",
  cashflow: "A receber / A pagar",
  nextToday: "Próximo hoje",
  lowStock: "Estoque baixo",
  chart: "Gráfico",
};

export const DEFAULT_DASHBOARD_LAYOUT: WidgetLayoutItem[] = [
  { id: "revenue", size: "sm" },
  { id: "clients", size: "sm" },
  { id: "services", size: "sm" },
  { id: "agenda", size: "sm" },
  { id: "cashflow", size: "md" },
  { id: "nextToday", size: "sm" },
  { id: "lowStock", size: "sm" },
  { id: "chart", size: "md" },
];

const ALL_IDS = new Set(DEFAULT_DASHBOARD_LAYOUT.map((item) => item.id));

function isWidgetSize(value: unknown): value is WidgetSize {
  return value === "sm" || value === "md" || value === "lg";
}

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && ALL_IDS.has(value as WidgetId);
}

export function nextWidgetSize(size: WidgetSize): WidgetSize {
  const index = WIDGET_SIZE_ORDER.indexOf(size);
  return WIDGET_SIZE_ORDER[(index + 1) % WIDGET_SIZE_ORDER.length];
}

export function widgetSizeClass(size: WidgetSize): string {
  switch (size) {
    case "sm":
      return "col-span-1";
    case "md":
      return "col-span-1 md:col-span-2";
    case "lg":
      return "col-span-1 md:col-span-4";
  }
}

export function normalizeDashboardLayout(
  input: unknown
): WidgetLayoutItem[] {
  if (!input || typeof input !== "object") {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }

  const record = input as { version?: unknown; widgets?: unknown };
  const widgets = Array.isArray(record.widgets) ? record.widgets : null;
  if (!widgets) {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }

  const seen = new Set<WidgetId>();
  const normalized: WidgetLayoutItem[] = [];

  for (const raw of widgets) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { id?: unknown; size?: unknown };
    if (!isWidgetId(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    normalized.push({
      id: item.id,
      size: isWidgetSize(item.size)
        ? item.size
        : DEFAULT_DASHBOARD_LAYOUT.find((entry) => entry.id === item.id)?.size ??
          "sm",
    });
  }

  for (const fallback of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(fallback.id)) {
      normalized.push({ ...fallback });
    }
  }

  return normalized;
}

export function readStoredDashboardLayout(): WidgetLayoutItem[] {
  if (typeof window === "undefined") {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }

  try {
    const stored = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
    }
    return normalizeDashboardLayout(JSON.parse(stored));
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }
}

export function writeStoredDashboardLayout(layout: WidgetLayoutItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        version: DASHBOARD_LAYOUT_VERSION,
        widgets: normalizeDashboardLayout({ widgets: layout }),
      })
    );
  } catch {
    // Ignora falhas de armazenamento local.
  }
}

export function moveWidget(
  layout: WidgetLayoutItem[],
  fromIndex: number,
  toIndex: number
): WidgetLayoutItem[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= layout.length ||
    toIndex >= layout.length ||
    fromIndex === toIndex
  ) {
    return layout;
  }

  const next = [...layout];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
