import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import {
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Users,
} from "lucide-react";

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

  if (hour >= 4 && hour < 12) {
    return "Bom dia";
  }

  if (hour >= 12 && hour < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

function formatDashboardDate(date: Date) {
  const parts = dateFormatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!weekday || !day || !month || !year) {
    return dateFormatter.format(date);
  }

  return `${capitalize(weekday)}, ${day} de ${capitalize(month)} de ${year}`;
}

function getDisplayName(fullName?: string | null, email?: string | null) {
  const name = fullName?.trim() || email?.split("@")[0]?.trim();
  const firstName = name?.split(/\s+/)[0];

  return firstName ? capitalize(firstName) : "usuário";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
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

  if (profile?.workshop_id) {
    const { data } = await supabase
      .from("dashboard_stats")
      .select("*")
      .eq("workshop_id", profile.workshop_id)
      .single();

    if (data) {
      stats = {
        monthly_revenue: Number(data.monthly_revenue),
        open_orders: Number(data.open_orders),
        completed_orders_month: Number(data.completed_orders_month),
        total_clients: Number(data.total_clients),
      };
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {getGreeting(now)}, {getDisplayName(profile?.full_name, user?.email)}.
        </h1>
        <p className="mt-3 text-lg font-medium text-muted">
          {formatDashboardDate(now)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Faturamento do Mês"
          value={formatCurrency(stats.monthly_revenue)}
          icon={<DollarSign className="h-6 w-6" />}
          variant="success"
          trend="Receitas de OS finalizadas"
        />
        <StatCard
          title="Serviços Abertos"
          value={String(stats.open_orders)}
          icon={<ClipboardList className="h-6 w-6" />}
          variant="warning"
          trend="Aguardando execução"
        />
        <StatCard
          title="Serviços Finalizados"
          value={String(stats.completed_orders_month)}
          icon={<CheckCircle2 className="h-6 w-6" />}
          variant="info"
          trend="No mês atual"
        />
        <StatCard
          title="Clientes Cadastrados"
          value={String(stats.total_clients)}
          icon={<Users className="h-6 w-6" />}
          variant="default"
        />
      </div>
    </>
  );
}
