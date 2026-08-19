import type { ReportTransactionType } from "@/lib/reports/types";

export function formatSequentialNumber(
  type: ReportTransactionType | null | undefined,
  value: number | null | undefined
) {
  if (value == null || !Number.isFinite(value) || value < 1) return "—";
  const prefix = type === "despesa" ? "D" : "R";
  return `${prefix}-${String(Math.trunc(value)).padStart(4, "0")}`;
}
