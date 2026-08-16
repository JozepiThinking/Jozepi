"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils/format";

const BAR_COLORS = ["#1a2744", "#c9a84c", "#e05555", "#3b82f6", "#22c55e", "#6b7280"];

export interface CategoryBarPoint {
  key: string;
  label: string;
  value: number;
}

interface CategoryBarChartProps {
  data: CategoryBarPoint[];
}

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(id);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-background text-sm text-muted">
        Nenhuma despesa no período selecionado.
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="relative flex h-56 items-end gap-3 overflow-hidden rounded-lg bg-background px-4 pb-8 pt-4">
      {hoveredIndex !== null && (
        <div
          className="pointer-events-none absolute z-20 min-w-[150px] rounded-xl border border-border bg-card px-3 py-2.5 text-xs shadow-xl"
          style={{
            left: `calc(${((hoveredIndex + 0.5) / data.length) * 100}% - 75px)`,
            top: "8px",
          }}
        >
          <p className="mb-1 font-bold text-foreground">{data[hoveredIndex].label}</p>
          <p className="text-muted">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(data[hoveredIndex].value)}
            </span>
          </p>
        </div>
      )}

      {data.map((item, i) => {
        const height = mounted ? Math.max(3, (item.value / maxValue) * 100) : 2;
        const color = BAR_COLORS[i % BAR_COLORS.length];
        const dimmed = hoveredIndex !== null && hoveredIndex !== i;

        return (
          <div
            key={item.key}
            className="relative flex h-full min-w-0 flex-1 cursor-pointer select-none flex-col items-center justify-end gap-2"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="w-full max-w-10 rounded-t-[6px]"
              style={{
                height: `${height}%`,
                background: color,
                opacity: dimmed ? 0.35 : 1,
                transition: "height 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
              }}
            />
            <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
