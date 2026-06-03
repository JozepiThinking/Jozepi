import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import {
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Users,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("workshop_id")
    .single();

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
      <Header
        title="Dashboard"
        description="Visão geral do seu negócio"
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Faturamento do Mês"
          value={formatCurrency(stats.monthly_revenue)}
          icon={<DollarSign className="h-6 w-6" />}
          variant="success"
          trend="Receitas de OS finalizadas"
        />
        <StatCard
          title="Ordens Abertas"
          value={String(stats.open_orders)}
          icon={<ClipboardList className="h-6 w-6" />}
          variant="warning"
          trend="Aguardando execução"
        />
        <StatCard
          title="Ordens Finalizadas"
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
