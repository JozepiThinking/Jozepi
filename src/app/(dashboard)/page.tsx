import Link from "next/link";
import {
  CalendarBlank,
  Clock,
  CurrencyDollar,
  ListChecks,
  UserCircle,
  UsersThree,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { StatCard } from "@/components/ui/stat-card";
import { RevenueMiniChart } from "@/components/dashboard/revenue-mini-chart";
import { formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import type { MonthChartData } from "@/components/finance/revenue-expense-chart";

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

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
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

function formatShortDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return capitalize(shortDateFormatter.format(date));
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
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

type AppointmentClient = { name: string; phone: string | null };

type AppointmentRow = {
  id: string;
  scheduled_date: string;
  scheduled_start: string | null;
  status: string;
  clients: AppointmentClient | AppointmentClient[] | null;
  service_order_items: {
    services: { name: string } | { name: string }[] | null;
  }[];
};

type ProductRow = {
  name: string;
  type: string;
  stock_remaining: string | null;
  volume_ml: string | null;
  quantity: string | null;
};

function getClientName(clients: AppointmentRow["clients"]): string {
  if (!clients) return "Cliente";
  if (Array.isArray(clients)) return clients[0]?.name ?? "Cliente";
  return clients.name;
}

function getClientPhone(clients: AppointmentRow["clients"]): string | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0]?.phone ?? null;
  return clients.phone;
}

function buildWhatsAppUrl(
  phone: string | null,
  clientName: string,
  service: string,
  date: string,
  time: string | null
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const phoneWithCode = digits.startsWith("55") ? digits : `55${digits}`;
  const [year, month, day] = date.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dateFmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(dateObj);
  const timePart = time ? ` às ${time.slice(0, 5)}` : "";
  const msg = `Olá ${clientName}! Confirmando seu agendamento de ${service} para ${dateFmt}${timePart}. Qualquer dúvida estou à disposição! 🚗`;
  return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`;
}

function getServiceNames(items: AppointmentRow["service_order_items"]): string {
  const names = items
    .map((item) => {
      if (!item.services) return null;
      if (Array.isArray(item.services)) return item.services[0]?.name ?? null;
      return item.services.name;
    })
    .filter(Boolean) as string[];
  return names.length > 0 ? names.join(", ") : "Serviço";
}

function getStatusLabel(status: string) {
  if (status === "em_andamento") return "Confirmado";
  if (status === "aberta") return "Pendente";
  return "Pendente";
}

function getStatusClasses(status: string) {
  if (status === "em_andamento")
    return "bg-premium/10 text-premium";
  return "bg-warning/10 text-warning";
}

function getProductStockPercent(product: ProductRow): number {
  const remaining = parseFloat(product.stock_remaining ?? "0");
  const initial =
    parseFloat(
      product.type === "liquid"
        ? (product.volume_ml ?? "1")
        : (product.quantity ?? "1")
    ) || 1;
  return (remaining / initial) * 100;
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
  type NextAppointment = { scheduled_start: string | null; clients: AppointmentRow["clients"] };
  let nextTodayAppointment: NextAppointment | null = null;
  let lowStockProducts: ProductRow[] = [];
  let monthlyChartData: MonthChartData[] = [];
  let maxChartValue = 1;

  if (profile?.workshop_id) {
    const workshopId = profile.workshop_id;

    const { data: statsData } = await supabase
      .from("dashboard_stats")
      .select("*")
      .eq("workshop_id", workshopId)
      .single();

    if (statsData) {
      stats = {
        monthly_revenue: Number(statsData.monthly_revenue),
        open_orders: Number(statsData.open_orders),
        completed_orders_month: Number(statsData.completed_orders_month),
        total_clients: Number(statsData.total_clients),
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
    lowStockProducts = allProducts.filter(
      (p) => getProductStockPercent(p) < 20
    );

    // Last 6 months financial transactions for mini chart
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

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">
          {getGreeting(now)},{" "}
          {getDisplayName(profile?.full_name, user?.email)}.
        </h1>
        <p className="page-subtitle mt-3 text-base">
          {formatDashboardDate(now)}
        </p>
      </div>

      {/* ── Top row: 3 stat cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Faturamento do Mês"
          value={formatCurrency(stats.monthly_revenue)}
          icon={<CurrencyDollar size={24} weight="light" />}
          variant="success"
          trend="Receitas de OS finalizadas"
        />
        <StatCard
          title="Clientes Cadastrados"
          value={String(stats.total_clients)}
          icon={<UsersThree size={24} weight="light" />}
          variant="default"
          trend="Ver todos os clientes"
          href="/clientes"
        />
        {/* Serviços do mês — inline card (same height as StatCards) */}
        <div className="card-surface flex flex-col justify-between">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks size={16} weight="light" className="text-muted" />
            <p className="label-caps">Serviços do Mês</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold text-foreground leading-none">
                {stats.open_orders}
              </span>
              <span className="mt-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning self-start">
                Abertos
              </span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold text-foreground leading-none">
                {stats.completed_orders_month}
              </span>
              <span className="mt-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success self-start">
                Finalizados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle: 2/3 agenda + 1/3 sidebar ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Agenda da semana — compact */}
        <div className="card-surface md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarBlank size={16} weight="light" className="text-muted" />
              <h2 className="text-sm font-semibold text-foreground">
                Agenda da semana
              </h2>
            </div>
            <span className="text-xs text-muted">Próximos 7 dias</span>
          </div>

          {weekAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarBlank size={32} weight="light" className="mb-2 text-muted/40" />
              <p className="text-sm font-medium text-foreground">
                Nenhum agendamento esta semana
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Adicione agendamentos na página de Agenda
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {weekAppointments.map((appt) => {
                const clientName = getClientName(appt.clients);
                const service = getServiceNames(appt.service_order_items);
                const phone = getClientPhone(appt.clients);
                const waUrl = buildWhatsAppUrl(
                  phone,
                  clientName,
                  service,
                  appt.scheduled_date,
                  appt.scheduled_start
                );
                return (
                  <li
                    key={appt.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[10px] font-semibold uppercase text-muted">
                          {formatShortDate(appt.scheduled_date)}
                        </p>
                        {appt.scheduled_start && (
                          <p className="text-xs font-medium text-foreground">
                            {formatTime(appt.scheduled_start)}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {clientName}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {service}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(appt.status)}`}
                      >
                        {getStatusLabel(appt.status)}
                      </span>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Enviar mensagem para ${clientName}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                        >
                          <WhatsappLogo size={16} weight="fill" style={{ color: "#25D366" }} />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <Link
              href="/agenda"
              className="text-xs font-semibold text-premium transition-opacity hover:opacity-70"
            >
              Ver agenda completa →
            </Link>
          </div>
        </div>

        {/* Right sidebar: Próximo hoje + Estoque baixo */}
        <div className="flex flex-col gap-4 md:col-span-1">
          {/* Próximo hoje */}
          <div className="card-surface">
            <div className="mb-2 flex items-center gap-2">
              <Clock size={15} weight="light" className="text-muted" />
              <p className="label-caps">Próximo Hoje</p>
            </div>
            {nextTodayAppointment ? (
              <div className="flex items-center gap-2.5">
                <UserCircle size={28} weight="light" className="shrink-0 text-premium" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {getClientName(nextTodayAppointment.clients)}
                  </p>
                  <p className="text-xs text-muted">
                    {formatTime(nextTodayAppointment.scheduled_start)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">Nenhum agendamento pendente hoje</p>
            )}
          </div>

          {/* Estoque baixo */}
          <div className="card-surface flex-1">
            <div className="mb-2 flex items-center gap-2">
              <WarningCircle size={15} weight="light" className="text-muted" />
              <p className="label-caps">Estoque Baixo</p>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-muted">Todos os produtos com estoque adequado</p>
            ) : (
              <ul className="space-y-1.5">
                {lowStockProducts.slice(0, 5).map((product) => {
                  const pct = Math.round(getProductStockPercent(product));
                  return (
                    <li key={product.name} className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-foreground">
                        {product.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
                {lowStockProducts.length > 5 && (
                  <li className="text-[11px] text-muted">
                    +{lowStockProducts.length - 5} outros
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: full-width chart ── */}
      <RevenueMiniChart data={monthlyChartData} maxValue={maxChartValue} />
    </>
  );
}
