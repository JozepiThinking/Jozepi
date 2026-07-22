import { DashboardBoard } from "@/components/dashboard/dashboard-board";
import type { MonthChartData } from "@/components/finance/revenue-expense-chart";
import type {
  AppointmentRow,
  DashboardData,
  NextAppointment,
  PendingExpenseRow,
  ProductRow,
  UnpaidOrderRow,
} from "@/lib/dashboard/types";
import { getProductStockPercent } from "@/lib/dashboard/types";
import { createClient } from "@/lib/supabase/server";

const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";

const hourFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "numeric",
  hour12: false,
  timeZone: DASHBOARD_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: DASHBOARD_TIME_ZONE,
});

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function getGreeting(date: Date) {
  const hour = Number(
    hourFormatter.formatToParts(date).find((part) => part.type === "hour")
      ?.value ?? 0
  );
  if (hour >= 4 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDashboardDate(date: Date) {
  const parts = dateFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (!weekday || !day || !month || !year) return dateFormatter.format(date);
  return `${capitalize(weekday)}, ${day} de ${capitalize(month)} de ${year}`;
}

function getDisplayName(fullName?: string | null, email?: string | null) {
  const name = fullName?.trim() || email?.split("@")[0]?.trim();
  const firstName = name?.split(/\s+/)[0];
  return firstName ? capitalize(firstName) : "usuário";
}

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const todayStr = toDateStr(now);
  const weekEndStr = toDateStr(addDays(now, 6));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { workshop_id: string | null; full_name: string | null } | null =
    null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("workshop_id, full_name")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  let stats = {
    monthly_revenue: 0,
    open_orders: 0,
    completed_orders_month: 0,
    total_clients: 0,
  };

  let weekAppointments: AppointmentRow[] = [];
  let nextTodayAppointment: NextAppointment | null = null;
  let lowStockProducts: ProductRow[] = [];
  let unpaidOrders: UnpaidOrderRow[] = [];
  let pendingExpenses: PendingExpenseRow[] = [];
  let monthlyChartData: MonthChartData[] = [];
  let maxChartValue = 1;

  if (profile?.workshop_id) {
    const workshopId = profile.workshop_id;

    const { data: statsData } = await supabase
      .from("dashboard_stats")
      .select("*")
      .eq("workshop_id", workshopId)
      .single();

    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const { count: openCount } = await supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .eq("workshop_id", workshopId)
      .in("status", ["aberta", "em_andamento"]);

    const { count: completedCount } = await supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .eq("workshop_id", workshopId)
      .eq("status", "finalizada")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd);

    const { data: revenueRows } = await supabase
      .from("service_orders")
      .select("total_amount")
      .eq("workshop_id", workshopId)
      .eq("status", "finalizada")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd);

    const monthlyRevenue = (revenueRows ?? []).reduce(
      (sum, row) => sum + Number(row.total_amount ?? 0),
      0
    );

    if (statsData) {
      stats = {
        monthly_revenue: monthlyRevenue,
        open_orders: openCount ?? 0,
        completed_orders_month: completedCount ?? 0,
        total_clients: Number(statsData.total_clients),
      };
    } else {
      stats = {
        ...stats,
        monthly_revenue: monthlyRevenue,
        open_orders: openCount ?? 0,
        completed_orders_month: completedCount ?? 0,
      };
    }

    const { data: weekData } = await supabase
      .from("service_orders")
      .select(
        "id, scheduled_date, scheduled_start, status, clients(name, phone), service_order_items(services(name))"
      )
      .eq("workshop_id", workshopId)
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", weekEndStr)
      .in("status", ["aberta", "em_andamento"])
      .order("scheduled_date")
      .order("scheduled_start")
      .limit(10);

    weekAppointments = (weekData as AppointmentRow[] | null) ?? [];

    const { data: nextData } = await supabase
      .from("service_orders")
      .select("scheduled_start, clients(name)")
      .eq("workshop_id", workshopId)
      .eq("scheduled_date", todayStr)
      .in("status", ["aberta", "em_andamento"])
      .order("scheduled_start")
      .limit(1)
      .maybeSingle();

    nextTodayAppointment = (nextData ?? null) as NextAppointment | null;

    const { data: productsData } = await supabase
      .from("products")
      .select("name, type, stock_remaining, volume_ml, quantity")
      .eq("workshop_id", workshopId)
      .not("stock_remaining", "is", null);

    const allProducts = (productsData as ProductRow[] | null) ?? [];
    lowStockProducts = allProducts.filter((p) => getProductStockPercent(p) < 20);

    const { data: unpaidData } = await supabase
      .from("service_orders")
      .select(
        "id, total_amount, completed_at, opened_at, payment_status, clients(name, phone), service_order_items(services(name))"
      )
      .eq("workshop_id", workshopId)
      .eq("status", "finalizada")
      .in("payment_status", ["pendente", "parcial"])
      .order("completed_at", { ascending: false })
      .limit(20);

    unpaidOrders = (unpaidData as UnpaidOrderRow[] | null) ?? [];

    const { data: pendingExpenseData, error: pendingExpenseError } =
      await supabase
        .from("financial_transactions")
        .select(
          "id, description, amount, transaction_date, category, payment_status"
        )
        .eq("workshop_id", workshopId)
        .eq("type", "despesa")
        .in("payment_status", ["pendente", "parcial"])
        .order("transaction_date", { ascending: false })
        .limit(20);

    if (!pendingExpenseError) {
      pendingExpenses = (pendingExpenseData as PendingExpenseRow[] | null) ?? [];
    }

    const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsAgoStr = toDateStr(sixMonthsAgoDate);
    const { data: txData } = await supabase
      .from("financial_transactions")
      .select("type, amount, transaction_date")
      .eq("workshop_id", workshopId)
      .gte("transaction_date", sixMonthsAgoStr);

    const txRows = (txData ?? []) as {
      type: string;
      amount: string | number;
      transaction_date: string;
    }[];

    monthlyChartData = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + idx, 1);
      const monthPrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "");
      const monthTx = txRows.filter((tx) =>
        tx.transaction_date?.startsWith(monthPrefix)
      );
      const revenue = monthTx
        .filter((tx) => tx.type === "receita")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = monthTx
        .filter((tx) => tx.type === "despesa")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return { label, revenue, expense };
    });

    maxChartValue = Math.max(
      1,
      ...monthlyChartData.flatMap((m) => [m.revenue, m.expense])
    );
  }

  const data: DashboardData = {
    greeting: getGreeting(now),
    greetingName: getDisplayName(profile?.full_name, user?.email),
    dateLabel: formatDashboardDate(now),
    stats,
    weekAppointments,
    nextTodayAppointment,
    lowStockProducts,
    unpaidOrders,
    pendingExpenses,
    monthlyChartData,
    maxChartValue,
  };

  return <DashboardBoard data={data} />;
}
