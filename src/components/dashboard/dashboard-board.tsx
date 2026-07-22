"use client";

import { useEffect, useState } from "react";
import {
  ArrowsOutCardinal,
  Check,
  Faders,
  SquaresFour,
} from "@phosphor-icons/react";
import { DashboardWidgetContent } from "@/components/dashboard/dashboard-widgets";
import type { DashboardData } from "@/lib/dashboard/types";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  moveWidget,
  nextWidgetSize,
  readStoredDashboardLayout,
  widgetSizeClass,
  WIDGET_LABELS,
  WIDGET_SIZE_LABELS,
  writeStoredDashboardLayout,
  type WidgetLayoutItem,
} from "@/lib/dashboard/widget-layout";
import { cn } from "@/lib/utils/cn";

export function DashboardBoard({ data }: { data: DashboardData }) {
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(DEFAULT_DASHBOARD_LAYOUT);
  const [hydrated, setHydrated] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setLayout(readStoredDashboardLayout());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredDashboardLayout(layout);
  }, [layout, hydrated]);

  function cycleSize(id: WidgetLayoutItem["id"]) {
    setLayout((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, size: nextWidgetSize(item.size) } : item
      )
    );
  }

  function resetLayout() {
    setLayout(DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item })));
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    setLayout((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggingId);
      const toIndex = prev.findIndex((item) => item.id === targetId);
      return moveWidget(prev, fromIndex, toIndex);
    });
    setDraggingId(null);
    setDragOverId(null);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            {data.greeting}, {data.greetingName}.
          </h1>
          <p className="page-subtitle mt-3 text-base">{data.dateLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              Restaurar padrão
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              editing
                ? "bg-success text-white hover:opacity-90"
                : "border border-border bg-card text-foreground hover:bg-background"
            )}
          >
            {editing ? (
              <>
                <Check size={14} weight="bold" aria-hidden />
                Concluir
              </>
            ) : (
              <>
                <SquaresFour size={14} weight="light" aria-hidden />
                Organizar
              </>
            )}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-premium/20 bg-premium/5 px-3 py-2.5 text-xs text-muted">
          <Faders size={14} weight="light" className="mt-0.5 shrink-0 text-premium" />
          <p>
            Arraste os blocos para reordenar. Toque em{" "}
            <span className="font-semibold text-foreground">P / M / G</span> para
            mudar o tamanho.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {layout.map((item) => (
          <article
            key={item.id}
            draggable={editing}
            onDragStart={() => {
              if (!editing) return;
              setDraggingId(item.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
            }}
            onDragOver={(event) => {
              if (!editing || !draggingId) return;
              event.preventDefault();
              setDragOverId(item.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(item.id);
            }}
            className={cn(
              "relative min-h-0 transition-transform",
              widgetSizeClass(item.size),
              editing && "rounded-xl ring-1 ring-border/80",
              editing && draggingId === item.id && "opacity-60",
              editing &&
                dragOverId === item.id &&
                draggingId !== item.id &&
                "ring-2 ring-premium"
            )}
          >
            {editing && (
              <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 text-[10px] font-semibold text-muted shadow-sm backdrop-blur">
                  <ArrowsOutCardinal size={12} weight="light" aria-hidden />
                  {WIDGET_LABELS[item.id]}
                </div>
                <button
                  type="button"
                  onClick={() => cycleSize(item.id)}
                  className="flex h-7 min-w-7 items-center justify-center rounded-full border border-border bg-card px-2 text-[11px] font-bold text-foreground shadow-sm"
                  aria-label={`Tamanho ${WIDGET_SIZE_LABELS[item.size]}`}
                  title="Alternar tamanho P/M/G"
                >
                  {WIDGET_SIZE_LABELS[item.size]}
                </button>
              </div>
            )}

            <div
              className={cn(
                "h-full",
                editing && "pointer-events-none pt-11",
                editing && "select-none"
              )}
            >
              <DashboardWidgetContent
                id={item.id}
                size={item.size}
                data={data}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
