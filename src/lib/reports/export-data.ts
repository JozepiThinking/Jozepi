import { formatShortDate } from "@/lib/reports/date-range";
import { sumReportAmount } from "@/lib/reports/data";
import { formatGeneratedAt } from "@/lib/timezone";
import type {
  ReportClient,
  ReportTransactionRow,
  ReportTransactionType,
  WorkshopInfo,
} from "@/lib/reports/types";

export interface ReportsExportMeta {
  workshop: WorkshopInfo;
  periodLabel: string;
  clientLabel: string;
  generatedAtLabel: string;
}

export interface ReportsReceiptRow {
  sequentialNumber: number | null;
  type: ReportTransactionType;
  date: string;
  description: string;
  amount: number;
}

export interface ReportsReceiptGroup {
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientDocument: string | null;
  clientAddress: string | null;
  rows: ReportsReceiptRow[];
  subtotal: number;
}

export interface ReportsReceiptPayload {
  meta: ReportsExportMeta;
  groups: ReportsReceiptGroup[];
  grandTotal: number;
}

export interface ReportsListExportPayload {
  meta: ReportsExportMeta;
  rows: {
    sequentialNumber: number | null;
    type: ReportTransactionType;
    date: string;
    client: string;
    description: string;
    category: string;
    amount: number;
  }[];
  total: number;
}

function buildGeneratedAtLabel(timeZone: string) {
  return formatGeneratedAt(new Date(), timeZone);
}

export function buildExportMeta(
  workshop: WorkshopInfo,
  periodLabel: string,
  clientLabel: string
): ReportsExportMeta {
  return {
    workshop,
    periodLabel,
    clientLabel,
    generatedAtLabel: buildGeneratedAtLabel(workshop.timezone),
  };
}

/**
 * Groups a flat list of transaction rows by client (falling back to the raw
 * clientName for rows without a clientId, e.g. expenses tied to a supplier)
 * so the PDF receipt can render one section + subtotal per client.
 */
export function buildReceiptPayload({
  rows,
  clients,
  workshop,
  periodLabel,
  clientLabel,
}: {
  rows: ReportTransactionRow[];
  clients: ReportClient[];
  workshop: WorkshopInfo;
  periodLabel: string;
  clientLabel: string;
}): ReportsReceiptPayload {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const groups = new Map<string, ReportsReceiptGroup>();

  for (const row of rows) {
    const key = row.clientId ?? `sem-cliente-${row.clientName}`;
    const client = row.clientId ? clientsById.get(row.clientId) : undefined;

    if (!groups.has(key)) {
      groups.set(key, {
        clientId: row.clientId,
        clientName: row.clientName,
        clientPhone: client?.phone ?? null,
        clientDocument: client?.document ?? null,
        clientAddress: client?.address ?? null,
        rows: [],
        subtotal: 0,
      });
    }

    const group = groups.get(key)!;
    group.rows.push({
      sequentialNumber: row.sequentialNumber,
      type: row.type,
      date: formatShortDate(row.date),
      description: row.description,
      amount: row.amount,
    });
    group.subtotal += row.amount;
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  return {
    meta: buildExportMeta(workshop, periodLabel, clientLabel),
    groups: sortedGroups,
    grandTotal: sumReportAmount(rows),
  };
}

export function buildListExportPayload({
  rows,
  workshop,
  periodLabel,
  clientLabel,
}: {
  rows: ReportTransactionRow[];
  workshop: WorkshopInfo;
  periodLabel: string;
  clientLabel: string;
}): ReportsListExportPayload {
  const sortedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return {
    meta: buildExportMeta(workshop, periodLabel, clientLabel),
    rows: sortedRows.map((row) => ({
      sequentialNumber: row.sequentialNumber,
      type: row.type,
      date: formatShortDate(row.date),
      client: row.clientName,
      description: row.description,
      category: row.category,
      amount: row.amount,
    })),
    total: sumReportAmount(rows),
  };
}
