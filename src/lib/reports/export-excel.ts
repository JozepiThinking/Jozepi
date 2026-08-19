import * as XLSX from "xlsx";
import { formatCurrency } from "@/lib/utils/format";
import { formatSequentialNumber } from "@/lib/reports/sequential-number";
import type { ReportsListExportPayload } from "@/lib/reports/export-data";

type SheetRow = (string | number)[];

function autoWidth(rows: SheetRow[]) {
  const widths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const length = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] ?? 10, Math.min(length + 2, 42));
    });
  });
  return widths.map((w) => ({ wch: w }));
}

function buildTransactionsSheet(payload: ReportsListExportPayload) {
  const { workshop } = payload.meta;
  const rows: SheetRow[] = [
    [workshop.name],
    ["Relatório de Lançamentos"],
    [`Período: ${payload.meta.periodLabel}`],
    [`Cliente: ${payload.meta.clientLabel}`],
    [`Gerado em: ${payload.meta.generatedAtLabel}`],
    [],
    ["Total no período", formatCurrency(payload.total)],
    ["Lançamentos", payload.rows.length],
    [],
    ["Data", "Nº", "Cliente", "Serviço", "Categoria", "Valor"],
    ...payload.rows.map((r) => [
      r.date,
      formatSequentialNumber(r.type, r.sequentialNumber),
      r.client,
      r.description,
      r.category,
      formatCurrency(r.amount),
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = autoWidth(rows);
  return sheet;
}

export function exportReportsToExcel(payload: ReportsListExportPayload) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildTransactionsSheet(payload), "Lançamentos");

  const fileSlug = payload.meta.periodLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");

  XLSX.writeFile(workbook, `relatorio-${fileSlug}.xlsx`);
}
