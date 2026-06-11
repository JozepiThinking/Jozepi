"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";

type FinanceTab = "overview" | "revenues" | "expenses" | "reports";
type PeriodFilter = "today" | "week" | "month" | "custom";
type TransactionType = "receita" | "despesa";

interface FinancialTransaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number | string;
  category: string | null;
  service_order_id: string | null;
  transaction_date: string;
  created_at: string;
}

interface CompletedOrderItem {
  quantity: number | string | null;
  unit_price: number | string | null;
  services: { name: string } | { name: string }[] | null;
}

interface CompletedOrder {
  id: string;
  total_amount: number | string;
  completed_at: string | null;
  opened_at: string | null;
  clients: { name: string } | { name: string }[] | null;
  service_order_items: CompletedOrderItem[] | null;
}

interface FinanceEntry {
  id: string;
  kind: "automatic" | "manual";
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  date: string;
  clientName?: string;
}

interface TransactionForm {
  description: string;
  amount: string;
  date: string;
  category: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

const tabs: { id: FinanceTab; label: string }[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "revenues", label: "Receitas" },
  { id: "expenses", label: "Despesas" },
  { id: "reports", label: "Relatórios" },
];

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "custom", label: "Personalizado" },
];

const revenueCategoryOptions = [
  { value: "Serviço", label: "Serviço" },
  { value: "Gorjeta", label: "Gorjeta" },
  { value: "Outros", label: "Outros" },
];

const expenseCategoryOptions = [
  { value: "Produtos", label: "Produtos" },
  { value: "Equipamentos", label: "Equipamentos" },
  { value: "Aluguel", label: "Aluguel" },
  { value: "Marketing", label: "Marketing" },
  { value: "Outros", label: "Outros" },
];
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

const initialRevenueForm: TransactionForm = {
  description: "",
  amount: "",
  date: dateKey(new Date()),
  category: "Serviço",
};

const initialExpenseForm: TransactionForm = {
  description: "",
  amount: "",
  date: dateKey(new Date()),
  category: "Produtos",
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
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

function getPeriodRange(
  period: PeriodFilter,
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

  if (period === "custom") {
    return {
      start: customStart ? startOfDay(parseLocalDate(customStart)) : startOfDay(baseDate),
      end: customEnd ? endOfDay(parseLocalDate(customEnd)) : endOfDay(baseDate),
    };
  }

  return { start: startOfMonth(baseDate), end: endOfMonth(baseDate) };
}

function isDateInRange(date: string, range: DateRange) {
  const parsed = parseLocalDate(date);
  return parsed >= range.start && parsed <= range.end;
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  return amount;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getOrderDate(order: CompletedOrder) {
  return (order.completed_at ?? order.opened_at ?? "").slice(0, 10);
}

function getOrderServiceNames(order: CompletedOrder) {
  return (order.service_order_items ?? [])
    .map((item) => firstRelation(item.services)?.name)
    .filter((name): name is string => Boolean(name));
}

function sumEntries(entries: FinanceEntry[]) {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function getMonthLabel(date: Date) {
  return shortMonthLabels[date.getMonth()];
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "R";
}

function formatShortDate(date: string) {
  const parsed = parseLocalDate(date);
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${day} ${shortMonthLabels[parsed.getMonth()]}`;
}

function toCurrencyNumber(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function SummaryCard({
  title,
  value,
  detail,
  icon,
  tone,
  valueTone,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "danger" | "muted";
  valueTone?: "success" | "danger";
}) {
  const toneStyles = {
    primary: {
      borderLeftColor: "var(--primary)",
      icon: "bg-primary/10 text-primary",
    },
    success: {
      borderLeftColor: "var(--finance-revenue)",
      icon: "bg-[var(--finance-revenue-soft)] text-[var(--finance-revenue)]",
    },
    danger: {
      borderLeftColor: "var(--danger)",
      icon: "bg-danger/10 text-danger",
    },
    muted: {
      borderLeftColor: "var(--muted)",
      icon: "bg-muted/10 text-muted",
    },
  }[tone];
  const valueClass =
    valueTone === "success"
      ? "text-success"
      : valueTone === "danger"
        ? "text-danger"
        : "text-foreground";

  return (
    <div
      style={{ borderLeftColor: toneStyles.borderLeftColor }}
      className="rounded-xl border border-l-4 border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className={`mt-2 text-2xl font-bold sm:text-3xl ${valueClass}`}>
            {value}
          </p>
          {detail && <p className="mt-1 text-xs font-semibold text-muted">{detail}</p>}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneStyles.icon}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function PeriodControls({
  value,
  customStart,
  customEnd,
  onChange,
  onCustomStartChange,
  onCustomEndChange,
}: {
  value: PeriodFilter;
  customStart: string;
  customEnd: string;
  onChange: (value: PeriodFilter) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-[220px_1fr_1fr] md:items-end">
      <Dropdown
        label="Período"
        value={value}
        options={periodOptions}
        onChange={(period) => onChange(period as PeriodFilter)}
      />
      {value === "custom" ? (
        <>
          <Input
            label="Início"
            type="date"
            value={customStart}
            onChange={(event) => onCustomStartChange(event.target.value)}
          />
          <Input
            label="Fim"
            type="date"
            value={customEnd}
            onChange={(event) => onCustomEndChange(event.target.value)}
          />
        </>
      ) : (
        <div className="rounded-xl bg-background px-4 py-3 text-sm font-semibold text-muted md:col-span-2">
          Mostrando lançamentos de {periodOptions.find((option) => option.value === value)?.label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

function TransactionList({
  entries,
  emptyMessage,
  onDeleteManual,
}: {
  entries: FinanceEntry[];
  emptyMessage: string;
  onDeleteManual?: (entryId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="hidden grid-cols-[minmax(180px,1fr)_130px_120px_120px_72px] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted md:grid">
        <span>Descrição</span>
        <span>Categoria</span>
        <span>Data</span>
        <span>Valor</span>
        <span className="text-right">Ações</span>
      </div>
      <div className="space-y-3 p-3 md:space-y-0 md:divide-y md:divide-border md:p-0">
        {entries.map((entry) => {
          const isRevenue = entry.type === "receita";
          return (
            <article
              key={entry.id}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-background/50 px-4 py-4 shadow-sm md:grid-cols-[minmax(180px,1fr)_130px_120px_120px_72px] md:items-center md:gap-3 md:rounded-none md:border-0 md:bg-transparent md:px-5 md:shadow-none"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.description}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      entry.kind === "automatic"
                        ? "bg-success/10 text-success"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {entry.kind === "automatic" ? "Agenda" : "Manual"}
                  </span>
                </div>
                {entry.clientName && (
                  <p className="mt-1 text-xs text-muted">{entry.clientName}</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-semibold text-foreground md:block md:bg-transparent md:p-0">
                <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                  Categoria
                </span>
                <span>{entry.category}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-semibold text-muted md:block md:bg-transparent md:p-0">
                <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                  Data
                </span>
                <span>{formatShortDate(entry.date)}</span>
              </div>
              <div
                className={`flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-bold md:block md:bg-transparent md:p-0 ${
                  isRevenue ? "text-success" : "text-danger"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-muted md:hidden">
                  Valor
                </span>
                <span>{formatCurrency(entry.amount)}</span>
              </div>
              <div className="flex justify-end">
                {entry.kind === "manual" && onDeleteManual ? (
                  <button
                    type="button"
                    onClick={() => onDeleteManual(entry.id)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white md:min-h-0 md:min-w-0"
                    aria-label={`Apagar ${entry.description}`}
                    title="Apagar lançamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-muted">Auto</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TransactionFormCard({
  title,
  description,
  form,
  categories,
  loading,
  error,
  buttonLabel,
  onChange,
  onSubmit,
}: {
  title: string;
  description: string;
  form: TransactionForm;
  categories: { value: string; label: string }[];
  loading: boolean;
  error: string | null;
  buttonLabel: string;
  onChange: (patch: Partial<TransactionForm>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      autoComplete="off"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Descrição"
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <Input
          label="Valor"
          prefix="R$"
          value={form.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
        <Input
          label="Data"
          type="date"
          value={form.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
        <Dropdown
          label="Categoria"
          value={form.category}
          options={categories}
          onChange={(category) => onChange({ category })}
        />
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="success" loading={loading} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}

function MonthlyBarChart({
  data,
  maxValue,
  compact = false,
}: {
  data: { label: string; revenue: number; expense: number }[];
  maxValue: number;
  compact?: boolean;
}) {
  return (
    <>
      <div
        className={`flex items-end gap-3 rounded-xl bg-background px-4 py-5 ${
          compact ? "h-64" : "h-72"
        }`}
      >
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className={`flex w-full items-end justify-center gap-1 ${
                compact ? "h-44" : "h-52"
              }`}
            >
              <div
                className="w-4 rounded-t-full bg-success transition-all"
                style={{
                  height: `${Math.max(4, (item.revenue / maxValue) * 100)}%`,
                }}
                title={`Receita: ${formatCurrency(item.revenue)}`}
              />
              <div
                className="w-4 rounded-t-full bg-danger transition-all"
                style={{
                  height: `${Math.max(4, (item.expense / maxValue) * 100)}%`,
                }}
                title={`Despesa: ${formatCurrency(item.expense)}`}
              />
            </div>
            <span className="text-xs font-semibold capitalize text-muted">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          Receita
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          Despesa
        </span>
      </div>
    </>
  );
}

export function FinancePage() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueForm, setRevenueForm] = useState<TransactionForm>(initialRevenueForm);
  const [expenseForm, setExpenseForm] = useState<TransactionForm>(initialExpenseForm);
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<PeriodFilter>("month");
  const [expensePeriod, setExpensePeriod] = useState<PeriodFilter>("month");
  const [revenueCustomStart, setRevenueCustomStart] = useState(dateKey(startOfMonth(today)));
  const [revenueCustomEnd, setRevenueCustomEnd] = useState(dateKey(today));
  const [expenseCustomStart, setExpenseCustomStart] = useState(dateKey(startOfMonth(today)));
  const [expenseCustomEnd, setExpenseCustomEnd] = useState(dateKey(today));

  async function loadFinanceData() {
    setLoading(true);
    setError(null);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (profileError || !profile?.workshop_id) {
      setError(profileError?.message ?? "Oficina não encontrada.");
      setLoading(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

    const [{ data: transactionsData, error: transactionsError }, { data: ordersData, error: ordersError }] =
      await Promise.all([
        supabase
          .from("financial_transactions")
          .select(
            "id, type, description, amount, category, service_order_id, transaction_date, created_at"
          )
          .eq("workshop_id", profile.workshop_id)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("service_orders")
          .select(
            `
            id,
            total_amount,
            completed_at,
            opened_at,
            clients(name),
            service_order_items(
              quantity,
              unit_price,
              services(name)
            )
          `
          )
          .eq("workshop_id", profile.workshop_id)
          .eq("status", "finalizada")
          .order("completed_at", { ascending: false }),
      ]);

    if (transactionsError) {
      setError(transactionsError.message);
    } else {
      setTransactions((transactionsData as FinancialTransaction[] | null) ?? []);
    }

    if (ordersError) {
      setError(ordersError.message);
    } else {
      setOrders((ordersData as CompletedOrder[] | null) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadFinanceData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const automaticRevenues = useMemo<FinanceEntry[]>(() => {
    return orders
      .map((order) => {
        const date = getOrderDate(order);
        if (!date) return null;

        const serviceNames = getOrderServiceNames(order);
        const client = firstRelation(order.clients);

        return {
          id: `order-${order.id}`,
          kind: "automatic" as const,
          type: "receita" as const,
          description:
            serviceNames.length > 0
              ? serviceNames.join(", ")
              : `Ordem finalizada ${order.id.slice(0, 8)}`,
          amount: toCurrencyNumber(order.total_amount),
          category: "Serviço",
          date,
          clientName: client?.name,
        };
      })
      .filter((entry): entry is FinanceEntry => Boolean(entry));
  }, [orders]);

  const manualEntries = useMemo<FinanceEntry[]>(() => {
    return transactions.map((transaction) => ({
      id: transaction.id,
      kind: "manual",
      type: transaction.type,
      description: transaction.description,
      amount: toCurrencyNumber(transaction.amount),
      category: transaction.category ?? "Outros",
      date: transaction.transaction_date,
    }));
  }, [transactions]);

  const revenueEntries = useMemo(
    () =>
      [...automaticRevenues, ...manualEntries.filter((entry) => entry.type === "receita")]
        .sort((a, b) => b.date.localeCompare(a.date)),
    [automaticRevenues, manualEntries]
  );
  const expenseEntries = useMemo(
    () =>
      manualEntries
        .filter((entry) => entry.type === "despesa")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [manualEntries]
  );

  const currentMonthRange = getPeriodRange("month", "", "", today);
  const previousMonthDate = addMonths(today, -1);
  const previousMonthRange = {
    start: startOfMonth(previousMonthDate),
    end: endOfMonth(previousMonthDate),
  };
  const todayRange = getPeriodRange("today", "", "", today);
  const monthRevenues = revenueEntries.filter((entry) =>
    isDateInRange(entry.date, currentMonthRange)
  );
  const monthExpenses = expenseEntries.filter((entry) =>
    isDateInRange(entry.date, currentMonthRange)
  );
  const previousMonthRevenues = revenueEntries.filter((entry) =>
    isDateInRange(entry.date, previousMonthRange)
  );
  const previousMonthExpenses = expenseEntries.filter((entry) =>
    isDateInRange(entry.date, previousMonthRange)
  );
  const monthRevenueTotal = sumEntries(monthRevenues);
  const monthExpenseTotal = sumEntries(monthExpenses);
  const monthProfit = monthRevenueTotal - monthExpenseTotal;
  const previousMonthProfit =
    sumEntries(previousMonthRevenues) - sumEntries(previousMonthExpenses);
  const monthGrowth =
    previousMonthProfit === 0
      ? monthProfit > 0
        ? 100
        : 0
      : ((monthProfit - previousMonthProfit) / Math.abs(previousMonthProfit)) * 100;
  const growthPositive = monthGrowth >= 0;

  const revenueRange = getPeriodRange(
    revenuePeriod,
    revenueCustomStart,
    revenueCustomEnd,
    today
  );
  const expenseRange = getPeriodRange(
    expensePeriod,
    expenseCustomStart,
    expenseCustomEnd,
    today
  );
  const filteredRevenueEntries = revenueEntries.filter((entry) =>
    isDateInRange(entry.date, revenueRange)
  );
  const filteredExpenseEntries = expenseEntries.filter((entry) =>
    isDateInRange(entry.date, expenseRange)
  );

  const reportMonths = Array.from({ length: 6 }, (_, index) =>
    addMonths(startOfMonth(today), index - 5)
  );
  const monthlyReport = reportMonths.map((month) => {
    const range = { start: startOfMonth(month), end: endOfMonth(month) };
    return {
      label: getMonthLabel(month),
      revenue: sumEntries(revenueEntries.filter((entry) => isDateInRange(entry.date, range))),
      expense: sumEntries(expenseEntries.filter((entry) => isDateInRange(entry.date, range))),
    };
  });
  const maxMonthlyValue = Math.max(
    1,
    ...monthlyReport.flatMap((item) => [item.revenue, item.expense])
  );

  const serviceRevenue = orders.reduce<Record<string, number>>((acc, order) => {
    const items = order.service_order_items ?? [];
    if (items.length === 0) {
      acc["Serviços"] = (acc["Serviços"] ?? 0) + toCurrencyNumber(order.total_amount);
      return acc;
    }

    items.forEach((item) => {
      const serviceName = firstRelation(item.services)?.name ?? "Serviço";
      const subtotal =
        toCurrencyNumber(item.unit_price) * (Number(item.quantity) || 1);
      acc[serviceName] = (acc[serviceName] ?? 0) + subtotal;
    });
    return acc;
  }, {});
  const serviceRanking = Object.entries(serviceRevenue)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const serviceTotal = serviceRanking.reduce((total, item) => total + item.amount, 0);
  const donutSegments = serviceRanking.reduce<
    { name: string; amount: number; dash: number; offset: number }[]
  >((segments, item) => {
    const previous = segments.reduce((total, segment) => total + segment.dash, 0);
    const dash = serviceTotal > 0 ? (item.amount / serviceTotal) * 100 : 0;
    return [...segments, { ...item, dash, offset: -previous }];
  }, []);

  const clientRanking = Object.values(
    orders.reduce<Record<string, { name: string; amount: number }>>((acc, order) => {
      const clientName = firstRelation(order.clients)?.name ?? "Cliente não encontrado";
      acc[clientName] = {
        name: clientName,
        amount: (acc[clientName]?.amount ?? 0) + toCurrencyNumber(order.total_amount),
      };
      return acc;
    }, {})
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const todayOrders = orders.filter((order) => {
    const orderDate = getOrderDate(order);
    return orderDate ? isDateInRange(orderDate, todayRange) : false;
  });
  const todayRevenue = sumEntries(
    revenueEntries.filter((entry) => isDateInRange(entry.date, todayRange))
  );
  const todayExpenses = sumEntries(
    expenseEntries.filter((entry) => isDateInRange(entry.date, todayRange))
  );
  const todayProfit = todayRevenue - todayExpenses;

  function resetForm(type: TransactionType) {
    if (type === "receita") {
      setRevenueForm({ ...initialRevenueForm, date: dateKey(today) });
      return;
    }

    setExpenseForm({ ...initialExpenseForm, date: dateKey(today) });
  }

  async function handleSaveManualTransaction(
    event: React.FormEvent<HTMLFormElement>,
    type: TransactionType
  ) {
    event.preventDefault();
    const form = type === "receita" ? revenueForm : expenseForm;
    const setFormError = type === "receita" ? setRevenueError : setExpenseError;
    const setSaving = type === "receita" ? setSavingRevenue : setSavingExpense;

    if (!workshopId) {
      setFormError("Oficina não encontrada.");
      return;
    }

    if (!form.description.trim()) {
      setFormError("Informe a descrição.");
      return;
    }

    let amount: number;
    try {
      amount = parseMoney(form.amount);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Informe um valor válido.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const { data, error: insertError } = await supabase
      .from("financial_transactions")
      .insert({
        workshop_id: workshopId,
        type,
        description: form.description.trim(),
        amount,
        category: form.category,
        transaction_date: form.date,
      })
      .select("id, type, description, amount, category, service_order_id, transaction_date, created_at")
      .single();

    setSaving(false);

    if (insertError) {
      setFormError(insertError.message);
      return;
    }

    if (data) {
      setTransactions((prev) => [data as FinancialTransaction, ...prev]);
    }
    resetForm(type);
  }

  async function handleDeleteManualTransaction(entryId: string) {
    const confirmed = window.confirm("Deseja apagar este lançamento?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("financial_transactions")
      .delete()
      .eq("id", entryId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTransactions((prev) => prev.filter((transaction) => transaction.id !== entryId));
  }

  return (
    <div
      className="space-y-6"
      style={
        {
          "--finance-revenue": "#16a34a",
          "--finance-revenue-soft": "rgba(22, 163, 74, 0.12)",
        } as React.CSSProperties
      }
    >
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Receita do mês"
          value={formatCurrency(monthRevenueTotal)}
          detail="OS concluídas + lançamentos manuais"
          icon={<ArrowUpRight className="h-6 w-6" />}
          tone="success"
        />
        <SummaryCard
          title="Despesas do mês"
          value={formatCurrency(monthExpenseTotal)}
          detail="Gastos lançados manualmente"
          icon={<ArrowDownRight className="h-6 w-6" />}
          tone="danger"
        />
        <SummaryCard
          title="Lucro líquido"
          value={formatCurrency(monthProfit)}
          detail="Receita menos despesas"
          icon={<Wallet className="h-6 w-6" />}
          tone="primary"
          valueTone={monthProfit >= 0 ? "success" : "danger"}
        />
        <SummaryCard
          title="Comparativo"
          value={formatPercent(monthGrowth)}
          detail="Vs. mês anterior"
          icon={
            growthPositive ? (
              <TrendingUp className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )
          }
          tone="muted"
          valueTone={growthPositive ? "success" : "danger"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-background hover:text-foreground hover:shadow-sm"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted shadow-sm">
          Carregando financeiro...
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-6">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Resumo do dia
                      </h2>
                      <p className="text-sm text-muted">
                        Serviços finalizados e resultado de hoje.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-background px-4 py-3">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Serviços
                      </p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {todayOrders.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Receita
                      </p>
                      <p className="mt-1 text-2xl font-bold text-success">
                        {formatCurrency(todayRevenue)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                        <Wallet className="h-3.5 w-3.5" />
                        Lucro
                      </p>
                      <p className={`mt-1 text-2xl font-bold ${todayProfit >= 0 ? "text-success" : "text-danger"}`}>
                        {formatCurrency(todayProfit)}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                      <BarChart3 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Receita vs despesa
                      </h2>
                      <p className="text-sm text-muted">Últimos 6 meses.</p>
                    </div>
                  </div>
                  <MonthlyBarChart
                    data={monthlyReport}
                    maxValue={maxMonthlyValue}
                    compact
                  />
                </section>
              </div>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground">
                  Últimas receitas
                </h2>
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/50">
                  {revenueEntries.slice(0, 5).map((entry) => {
                    const displayName = entry.clientName ?? "Receita manual";
                    const badgeLabel =
                      entry.kind === "automatic" ? entry.category : "Manual";

                    return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 bg-card/70 px-4 py-3 transition-colors hover:bg-card"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {getInitial(displayName)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {displayName}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                entry.kind === "automatic"
                                  ? "bg-success/10 text-success"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {entry.description} • {formatShortDate(entry.date)}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-success">
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                    );
                  })}
                  {revenueEntries.length === 0 && (
                    <p className="bg-background px-4 py-6 text-center text-sm text-muted">
                      Nenhuma receita registrada.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "revenues" && (
            <div className="space-y-5">
              <TransactionFormCard
                title="Lançar receita manual"
                description="Use para gorjetas, receitas avulsas ou ajustes."
                form={revenueForm}
                categories={revenueCategoryOptions}
                loading={savingRevenue}
                error={revenueError}
                buttonLabel="Adicionar receita"
                onChange={(patch) => setRevenueForm((prev) => ({ ...prev, ...patch }))}
                onSubmit={(event) => handleSaveManualTransaction(event, "receita")}
              />
              <PeriodControls
                value={revenuePeriod}
                customStart={revenueCustomStart}
                customEnd={revenueCustomEnd}
                onChange={setRevenuePeriod}
                onCustomStartChange={setRevenueCustomStart}
                onCustomEndChange={setRevenueCustomEnd}
              />
              <TransactionList
                entries={filteredRevenueEntries}
                emptyMessage="Nenhuma receita encontrada para este período."
                onDeleteManual={handleDeleteManualTransaction}
              />
            </div>
          )}

          {activeTab === "expenses" && (
            <div className="space-y-5">
              <TransactionFormCard
                title="Lançar despesa"
                description="Registre compras, custos fixos e investimentos."
                form={expenseForm}
                categories={expenseCategoryOptions}
                loading={savingExpense}
                error={expenseError}
                buttonLabel="Adicionar despesa"
                onChange={(patch) => setExpenseForm((prev) => ({ ...prev, ...patch }))}
                onSubmit={(event) => handleSaveManualTransaction(event, "despesa")}
              />
              <PeriodControls
                value={expensePeriod}
                customStart={expenseCustomStart}
                customEnd={expenseCustomEnd}
                onChange={setExpensePeriod}
                onCustomStartChange={setExpenseCustomStart}
                onCustomEndChange={setExpenseCustomEnd}
              />
              <TransactionList
                entries={filteredExpenseEntries}
                emptyMessage="Nenhuma despesa encontrada para este período."
                onDeleteManual={handleDeleteManualTransaction}
              />
            </div>
          )}

          {activeTab === "reports" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Receita vs despesa
                    </h2>
                    <p className="text-sm text-muted">Últimos 6 meses.</p>
                  </div>
                </div>
                <MonthlyBarChart data={monthlyReport} maxValue={maxMonthlyValue} />
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Serviços que mais geram receita
                    </h2>
                    <p className="text-sm text-muted">Com base nas OS finalizadas.</p>
                  </div>
                </div>
                {serviceRanking.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr] sm:items-center">
                    <svg viewBox="0 0 120 120" className="mx-auto h-40 w-40 -rotate-90">
                      <circle
                        cx="60"
                        cy="60"
                        r="44"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="18"
                      />
                      {donutSegments.map((segment, index) => (
                        <circle
                          key={segment.name}
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke={index === 0 ? "var(--primary)" : index === 1 ? "var(--success)" : index === 2 ? "var(--warning)" : "var(--muted)"}
                          strokeWidth="18"
                          strokeDasharray={`${segment.dash} ${100 - segment.dash}`}
                          strokeDashoffset={segment.offset}
                          pathLength="100"
                        />
                      ))}
                    </svg>
                    <div className="space-y-3">
                      {serviceRanking.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {index + 1}. {item.name}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-success">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted">
                    Nenhum serviço finalizado para gerar o gráfico.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <CircleDollarSign className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Ranking de clientes
                    </h2>
                    <p className="text-sm text-muted">Clientes que mais gastaram.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {clientRanking.length > 0 ? (
                    clientRanking.map((client, index) => (
                      <div key={client.name} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">
                          {index + 1}. {client.name}
                        </span>
                        <span className="text-sm font-bold text-success">
                          {formatCurrency(client.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted">
                      Nenhum cliente com receita finalizada.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Resumo operacional do dia
                    </h2>
                    <p className="text-sm text-muted">Serviços, receita e lucro.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-xl bg-background px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Serviços finalizados
                    </p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {todayOrders.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Receita do dia
                    </p>
                    <p className="mt-1 text-2xl font-bold text-success">
                      {formatCurrency(todayRevenue)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Lucro do dia
                    </p>
                    <p className={`mt-1 text-2xl font-bold ${todayProfit >= 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(todayProfit)}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
