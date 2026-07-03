"use client";

import Link from "next/link";
import { ChartBar } from "@phosphor-icons/react";
import { RevenueExpenseChart, type MonthChartData } from "@/components/finance/revenue-expense-chart";

interface RevenueMiniChartProps {
  data: MonthChartData[];
  maxValue: number;
}

export function RevenueMiniChart({ data, maxValue }: RevenueMiniChartProps) {
  return (
    <div className="card-surface mt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartBar size={18} weight="light" className="text-muted" />
          <h2 className="text-sm font-semibold text-foreground">
            Faturamento dos últimos 6 meses
          </h2>
        </div>
        <Link
          href="/financeiro"
          className="text-xs font-semibold text-premium transition-opacity hover:opacity-70"
        >
          Ver detalhes →
        </Link>
      </div>
      <RevenueExpenseChart data={data} maxValue={maxValue} compact />
    </div>
  );
}
