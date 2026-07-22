"use client";

import Link from "next/link";
import {
  CalendarBlank,
  Clock,
  CurrencyDollar,
  ListChecks,
  UserCircle,
  UsersThree,
  Wallet,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { RevenueMiniChart } from "@/components/dashboard/revenue-mini-chart";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";
import type { DashboardData } from "@/lib/dashboard/types";
import {
  buildWhatsAppUrl,
  formatShortDate,
  formatTime,
  getClientName,
  getClientPhone,
  getProductStockPercent,
  getServiceNames,
  getStatusClasses,
  getStatusLabel,
} from "@/lib/dashboard/types";
import type { WidgetId, WidgetSize } from "@/lib/dashboard/widget-layout";

export function DashboardWidgetContent({
  id,
  size,
  data,
}: {
  id: WidgetId;
  size: WidgetSize;
  data: DashboardData;
}) {
  switch (id) {
    case "revenue":
      return (
        <StatCard
          title="Faturamento do Mês"
          value={formatCurrency(data.stats.monthly_revenue)}
          icon={<CurrencyDollar size={24} weight="light" />}
          variant="success"
          trend="Receitas de OS finalizadas"
        />
      );
    case "clients":
      return (
        <StatCard
          title="Clientes Cadastrados"
          value={String(data.stats.total_clients)}
          icon={<UsersThree size={24} weight="light" />}
          variant="default"
          trend="Ver todos os clientes"
          href="/clientes"
        />
      );
    case "services":
      return (
        <div className="card-surface flex h-full flex-col justify-between">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks size={16} weight="light" className="text-muted" />
            <p className="label-caps">Serviços do Mês</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold leading-none text-foreground">
                {data.stats.open_orders}
              </span>
              <span className="mt-1 self-start rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                Abertos
              </span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold leading-none text-foreground">
                {data.stats.completed_orders_month}
              </span>
              <span className="mt-1 self-start rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                Finalizados
              </span>
            </div>
          </div>
        </div>
      );
    case "agenda":
      return <AgendaWidget data={data} />;
    case "cashflow":
      return <CashflowWidget data={data} size={size} />;
    case "nextToday":
      return <NextTodayWidget data={data} />;
    case "lowStock":
      return <LowStockWidget data={data} />;
    case "chart":
      return (
        <div className={size === "sm" ? "max-w-none" : undefined}>
          <RevenueMiniChart
            data={data.monthlyChartData}
            maxValue={data.maxChartValue}
          />
        </div>
      );
  }
}

function AgendaWidget({ data }: { data: DashboardData }) {
  return (
    <div className="card-surface flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarBlank size={16} weight="light" className="text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Agenda da semana</h2>
        </div>
        <span className="text-xs text-muted">7 dias</span>
      </div>

      {data.weekAppointments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <CalendarBlank size={28} weight="light" className="mb-2 text-muted/40" />
          <p className="text-sm font-medium text-foreground">
            Nenhum agendamento esta semana
          </p>
          <p className="mt-0.5 text-xs text-muted">Adicione agendamentos na Agenda</p>
        </div>
      ) : (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto">
          {data.weekAppointments.map((appt) => {
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
                <div className="flex min-w-0 items-center gap-2">
                  <div className="w-12 shrink-0 text-center">
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
                    <p className="truncate text-[11px] text-muted">{service}</p>
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
                      <WhatsappLogo
                        size={16}
                        weight="fill"
                        style={{ color: "#25D366" }}
                      />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto border-t border-border pt-3">
        <Link
          href="/agenda"
          className="text-xs font-semibold text-premium transition-opacity hover:opacity-70"
        >
          Ver agenda completa →
        </Link>
      </div>
    </div>
  );
}

function CashflowWidget({
  data,
  size,
}: {
  data: DashboardData;
  size: WidgetSize;
}) {
  const split = size !== "sm";

  return (
    <div className="card-surface flex h-full min-h-0 flex-col">
      <div
        className={`grid min-h-0 flex-1 ${
          split
            ? "grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0"
            : "grid-cols-1 gap-4"
        }`}
      >
        <div className={`flex min-h-0 flex-col ${split ? "sm:pr-4" : ""}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet size={16} weight="light" className="text-muted" />
              <h2 className="text-sm font-semibold text-foreground">A receber</h2>
            </div>
            {data.unpaidOrders.length > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                {data.unpaidOrders.length}
              </span>
            )}
          </div>
          {data.unpaidOrders.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
              <p className="text-sm font-medium text-foreground">Nada a receber</p>
              <p className="mt-0.5 text-xs text-muted">Serviços em dia</p>
            </div>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {data.unpaidOrders.map((order) => {
                const clientName = getClientName(order.clients);
                const service = getServiceNames(order.service_order_items);
                const dateStr = (order.completed_at ?? order.opened_at)?.slice(0, 10);
                return (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {clientName}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {service}
                        {dateStr ? ` · ${formatShortDate(dateStr)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-success">
                        {formatCurrency(Number(order.total_amount ?? 0))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          order.payment_status === "parcial"
                            ? "bg-premium/10 text-premium"
                            : "bg-muted/10 text-muted"
                        }`}
                      >
                        {order.payment_status === "parcial" ? "Parcial" : "Pendente"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className={`flex min-h-0 flex-col ${
            split ? "pt-4 sm:pl-4 sm:pt-0" : ""
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={16} weight="light" className="text-muted" />
              <h2 className="text-sm font-semibold text-foreground">A pagar</h2>
            </div>
            {data.pendingExpenses.length > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                {data.pendingExpenses.length}
              </span>
            )}
          </div>
          {data.pendingExpenses.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
              <p className="text-sm font-medium text-foreground">Nada a pagar</p>
              <p className="mt-0.5 text-xs text-muted">Despesas em dia</p>
            </div>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto">
              {data.pendingExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {expense.description}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {expense.category ?? "Despesa"}
                      {expense.transaction_date
                        ? ` · ${formatShortDate(expense.transaction_date)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold text-danger">
                      {formatCurrency(Number(expense.amount ?? 0))}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        expense.payment_status === "parcial"
                          ? "bg-premium/10 text-premium"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {expense.payment_status === "parcial" ? "Parcial" : "Pendente"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <Link
          href="/financeiro"
          className="text-xs font-semibold text-premium transition-opacity hover:opacity-70"
        >
          Ver financeiro →
        </Link>
      </div>
    </div>
  );
}

function NextTodayWidget({ data }: { data: DashboardData }) {
  return (
    <div className="card-surface h-full">
      <div className="mb-2 flex items-center gap-2">
        <Clock size={15} weight="light" className="text-muted" />
        <p className="label-caps">Próximo Hoje</p>
      </div>
      {data.nextTodayAppointment ? (
        <div className="flex items-center gap-2.5">
          <UserCircle size={28} weight="light" className="shrink-0 text-premium" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {getClientName(data.nextTodayAppointment.clients)}
            </p>
            <p className="text-xs text-muted">
              {formatTime(data.nextTodayAppointment.scheduled_start)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Nenhum agendamento pendente hoje</p>
      )}
    </div>
  );
}

function LowStockWidget({ data }: { data: DashboardData }) {
  return (
    <div className="card-surface flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <WarningCircle size={15} weight="light" className="text-muted" />
        <p className="label-caps">Estoque Baixo</p>
      </div>
      {data.lowStockProducts.length === 0 ? (
        <p className="text-xs text-muted">Todos os produtos com estoque adequado</p>
      ) : (
        <ul className="space-y-1.5">
          {data.lowStockProducts.slice(0, 5).map((product) => {
            const pct = Math.round(getProductStockPercent(product));
            return (
              <li
                key={product.name}
                className="flex items-center justify-between gap-2"
              >
                <p className="truncate text-xs font-medium text-foreground">
                  {product.name}
                </p>
                <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                  {pct}%
                </span>
              </li>
            );
          })}
          {data.lowStockProducts.length > 5 && (
            <li className="text-[11px] text-muted">
              +{data.lowStockProducts.length - 5} outros
            </li>
          )}
        </ul>
      )}
      <div className="mt-auto pt-3">
        <Link
          href="/produtos"
          className="text-xs font-semibold text-premium transition-opacity hover:opacity-70"
        >
          Ver estoque →
        </Link>
      </div>
    </div>
  );
}
