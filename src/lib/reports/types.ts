export interface ReportClient {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
  address: string | null;
}

export interface WorkshopInfo {
  name: string;
  document: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  timezone: string;
}

export type RevenueKind = "automatic" | "manual";

export interface ReportRevenueEntry {
  id: string;
  date: string;
  clientId: string | null;
  clientName: string;
  serviceName: string;
  category: string;
  kind: RevenueKind;
  amount: number;
  sequentialNumber: number | null;
}

export interface ReportExpenseEntry {
  id: string;
  date: string;
  description: string;
  supplierName: string;
  category: string;
  amount: number;
  sequentialNumber: number | null;
}

export interface ReportsSourceData {
  workshop: WorkshopInfo;
  clients: ReportClient[];
  revenueEntries: ReportRevenueEntry[];
  expenseEntries: ReportExpenseEntry[];
}

export type ReportTransactionType = "receita" | "despesa";

export interface ReportTransactionRow {
  id: string;
  type: ReportTransactionType;
  date: string;
  clientId: string | null;
  clientName: string;
  description: string;
  category: string;
  amount: number;
  sequentialNumber: number | null;
}
