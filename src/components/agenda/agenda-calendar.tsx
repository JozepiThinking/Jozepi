"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarBlank,
  CalendarX,
  Car,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { syncVehicles } from "@/lib/clients/sync-vehicles";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, normalizePhone } from "@/lib/utils/format";
import {
  getProductRemainingStock,
  parsePositiveNumber,
} from "@/lib/products/catalog";
import {
  loadSupabaseCatalog,
  saveSupabaseProduct,
} from "@/lib/products/supabase-catalog";
import { type Client, type ClientFormData } from "@/types/client";

type AppointmentStatus = "Confirmado" | "Pendente" | "Cancelado" | "Concluído";

interface Appointment {
  id: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  clientId: string;
  vehicleId: string;
  serviceIds: string[];
  client: string;
  service: string;
  totalAmount: number;
  vehicle: string;
  status: AppointmentStatus;
}

interface AppointmentForm {
  date: string;
  endDate: string;
  isMultiDay: boolean;
  startTime: string;
  endTime: string;
  clientId: string;
  vehicleId: string;
  serviceIds: string[];
  totalAmount: string;
}

interface AgendaService {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number | null;
  active: boolean;
}

type ServiceOrderStatus =
  | "aberta"
  | "em_andamento"
  | "finalizada"
  | "cancelada";

interface AppointmentOrderService {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number | null;
}

interface AppointmentOrderItem {
  service_id: string;
  unit_price: number | string;
  services: AppointmentOrderService | AppointmentOrderService[] | null;
}

interface AppointmentOrderRow {
  id: string;
  client_id: string;
  vehicle_id: string;
  status: ServiceOrderStatus | string;
  total_amount: number | string;
  scheduled_date: string | null;
  scheduled_end_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  clients: { name: string } | { name: string }[] | null;
  vehicles:
    | { brand: string; model: string; plate: string }
    | { brand: string; model: string; plate: string }[]
    | null;
  service_order_items: AppointmentOrderItem[] | null;
}

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface AppointmentOccurrence extends Appointment {
  occurrenceDate: string;
  isMultiDay: boolean;
  isContinuation: boolean;
  isFirstDay: boolean;
  isLastDay: boolean;
  durationDays: number;
}

const statusStyles: Record<
  AppointmentStatus,
  {
    calendarPill: string;
    timelineBlock: string;
    sideCard: string;
    sideAccent: string;
    statusBadge: string;
    timeBadge: string;
  }
> = {
  Confirmado: {
    calendarPill: "status-pill-confirmed",
    timelineBlock: "status-confirmed-solid",
    sideCard: "status-confirmed-card",
    sideAccent: "status-confirmed-side-accent",
    statusBadge: "status-confirmed-soft",
    timeBadge: "status-confirmed-soft",
  },
  Pendente: {
    calendarPill: "status-pill-pending",
    timelineBlock: "bg-warning",
    sideCard: "border-warning/20 bg-warning/5",
    sideAccent: "border-l-[var(--warning)]",
    statusBadge: "bg-warning/10 text-warning",
    timeBadge: "bg-warning/10 text-warning",
  },
  Cancelado: {
    calendarPill: "status-pill-cancelled",
    timelineBlock: "bg-danger",
    sideCard: "border-danger/20 bg-danger/5",
    sideAccent: "border-l-[var(--danger)]",
    statusBadge: "bg-danger/10 text-danger",
    timeBadge: "bg-danger/10 text-danger",
  },
  Concluído: {
    calendarPill: "status-pill-completed",
    timelineBlock: "status-completed-solid",
    sideCard: "status-completed-card",
    sideAccent: "status-completed-side-accent",
    statusBadge: "status-completed-soft",
    timeBadge: "status-completed-soft",
  },
};

const appointmentStatuses: AppointmentStatus[] = [
  "Pendente",
  "Confirmado",
  "Concluído",
  "Cancelado",
];
type AgendaSelectId = "client" | "vehicle" | "service";

function getStatusStyle(status: AppointmentStatus) {
  return statusStyles[status];
}

const AGENDA_ICON_WEIGHT = "light" as const;

function AppointmentStatusLabel({
  status,
  iconSize = 14,
}: {
  status: AppointmentStatus;
  iconSize?: number;
}) {
  if (status !== "Concluído") {
    return status;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle
        size={iconSize}
        weight={AGENDA_ICON_WEIGHT}
        className="shrink-0"
        aria-hidden
      />
      {status}
    </span>
  );
}

function formatAppointmentCount(count: number) {
  return count === 1 ? "1 agendamento" : `${count} agendamentos`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const AGENDA_STORAGE_KEY = "auto-estetica-agenda-appointments";
const BUSINESS_START_TIME = "07:00";
const BUSINESS_END_TIME = "19:00";
const SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_AGENDA_CAPACITY = 1;
const AGENDA_CAPACITY_STORAGE_KEY = "auto-estetica-agenda-capacity";
const timeSlots = Array.from(
  {
    length:
      (timeToMinutes(BUSINESS_END_TIME) - timeToMinutes(BUSINESS_START_TIME)) /
      SLOT_INTERVAL_MINUTES,
  },
  (_, index) => {
    const totalMinutes =
      timeToMinutes(BUSINESS_START_TIME) + index * SLOT_INTERVAL_MINUTES;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");

    return `${hours}:${minutes}`;
  }
);

function isTimeBetween(time: string, startTime: string, endTime: string) {
  const current = timeToMinutes(time);
  return current > timeToMinutes(startTime) && current < timeToMinutes(endTime);
}

function isTimeInRange(time: string, startTime: string, endTime: string) {
  const current = timeToMinutes(time);
  return current >= timeToMinutes(startTime) && current < timeToMinutes(endTime);
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function getDateRangeKeys(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (end < start) return [startDate];

  const keys: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    keys.push(dateKey(day));
  }

  return keys;
}

function getAppointmentEndDate(appointment: Pick<Appointment, "date" | "endDate">) {
  return appointment.endDate || appointment.date;
}

function getAppointmentDurationDays(
  appointment: Pick<Appointment, "date" | "endDate">
) {
  return getDateRangeKeys(appointment.date, getAppointmentEndDate(appointment)).length;
}

function appointmentOccursOnDate(
  appointment: Pick<Appointment, "date" | "endDate">,
  date: string
) {
  return appointment.date <= date && date <= getAppointmentEndDate(appointment);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(parseLocalDate(date));
}

function formatAppointmentDuration(appointment: Pick<Appointment, "date" | "endDate">) {
  const durationDays = getAppointmentDurationDays(appointment);
  const endDate = getAppointmentEndDate(appointment);

  if (durationDays <= 1) return "1 dia";

  return `${durationDays} dias • ${formatShortDate(appointment.date)} a ${formatShortDate(endDate)}`;
}

function isAppointmentPast(appointment: Appointment, now: Date) {
  return new Date(`${getAppointmentEndDate(appointment)}T${appointment.endTime}:00`) <= now;
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getShortClientName(name: string) {
  const [firstName, secondName] = name.trim().split(/\s+/);
  return [firstName, secondName].filter(Boolean).join(" ");
}

function getServicePrice(service: AgendaService) {
  return Number(service.price) || 0;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDbTime(value: string | null) {
  return value?.slice(0, 5) ?? "";
}

function getAppointmentStatus(status: ServiceOrderStatus | string): AppointmentStatus {
  if (status === "em_andamento") return "Confirmado";
  if (status === "finalizada") return "Concluído";
  if (status === "cancelada") return "Cancelado";

  return "Pendente";
}

function getServiceOrderStatus(status: AppointmentStatus): ServiceOrderStatus {
  if (status === "Confirmado") return "em_andamento";
  if (status === "Concluído") return "finalizada";
  if (status === "Cancelado") return "cancelada";

  return "aberta";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingAgendaMigrationError(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);

  return (
    message.includes("scheduled_date") ||
    message.includes("scheduled_end_date") ||
    message.includes("scheduled_start") ||
    message.includes("scheduled_end") ||
    message.includes("schema cache")
  );
}

function isMissingAgendaCapacityError(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err);

  return (
    message.includes("agenda_capacity") ||
    message.includes("schema cache") ||
    message.includes("Could not find")
  );
}

function normalizeAgendaCapacity(value: number | string | null | undefined) {
  const capacity =
    typeof value === "number" ? value : Number(String(value ?? "").trim());

  return Number.isFinite(capacity) && capacity > 0
    ? Math.floor(capacity)
    : DEFAULT_AGENDA_CAPACITY;
}

function getLocalAgendaCapacityKey(workshopId: string) {
  return `${AGENDA_CAPACITY_STORAGE_KEY}-${workshopId}`;
}

function readLocalAgendaCapacityForImport(workshopId: string) {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(getLocalAgendaCapacityKey(workshopId));
    return stored ? normalizeAgendaCapacity(stored) : null;
  } catch {
    return null;
  }
}

function clearLocalAgendaCapacity(workshopId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getLocalAgendaCapacityKey(workshopId));
}

function readLocalAppointments() {
  if (typeof window === "undefined") return [];

  const storedAppointments = window.localStorage.getItem(AGENDA_STORAGE_KEY);
  if (!storedAppointments) return [];

  try {
    return (JSON.parse(storedAppointments) as Appointment[]).map((appointment) => ({
      ...appointment,
      endDate: appointment.endDate || appointment.date,
    }));
  } catch {
    window.localStorage.removeItem(AGENDA_STORAGE_KEY);
    return [];
  }
}

function clearLocalAppointments() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AGENDA_STORAGE_KEY);
}

function mapOrderToAppointment(order: AppointmentOrderRow): Appointment {
  const client = firstRelation(order.clients);
  const vehicle = firstRelation(order.vehicles);
  const serviceItems = order.service_order_items ?? [];
  const services = serviceItems
    .map((item) => firstRelation(item.services))
    .filter((service): service is AppointmentOrderService => Boolean(service));

  return {
    id: order.id,
    date: order.scheduled_date ?? dateKey(new Date()),
    endDate: order.scheduled_end_date ?? order.scheduled_date ?? dateKey(new Date()),
    startTime: normalizeDbTime(order.scheduled_start),
    endTime: normalizeDbTime(order.scheduled_end),
    clientId: order.client_id,
    vehicleId: order.vehicle_id,
    serviceIds: serviceItems.map((item) => item.service_id),
    client: client?.name ?? "Cliente não encontrado",
    service: services.map((service) => service.name).join(", "),
    totalAmount: Number(order.total_amount) || 0,
    vehicle: vehicle
      ? `${vehicle.brand} ${vehicle.model} - ${vehicle.plate}`
      : "Veículo não encontrado",
    status: getAppointmentStatus(order.status),
  };
}

function formatServiceDuration(minutes: number | null) {
  if (!minutes) return null;

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h${String(remainingMinutes).padStart(2, "0")}`
    : `${hours}h`;
}

function buildCalendarDays(currentMonth: Date) {
  const firstDay = startOfMonth(currentMonth);
  const lastDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  );

  return Array.from({ length: lastDay.getDate() }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(index + 1);
    return day;
  });
}

function AgendaDropdown({
  id,
  value,
  placeholder,
  emptyMessage,
  options,
  disabled = false,
  open,
  searchable = false,
  searchPlaceholder = "Digite para pesquisar",
  noResultsMessage = "Nenhum resultado encontrado.",
  onToggle,
  onSelect,
  onClear,
  clearLabel = "Limpar seleção",
}: {
  id: string;
  value: string;
  placeholder: string;
  emptyMessage: string;
  options: SelectOption[];
  disabled?: boolean;
  open: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredOptions =
    searchable && normalizedSearchQuery
      ? options.filter((option) =>
          [option.label, option.description]
            .filter(Boolean)
            .some((field) =>
              field?.toLowerCase().includes(normalizedSearchQuery)
            )
        )
      : options;

  useEffect(() => {
    if (searchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) setSearchQuery("");
          onToggle();
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 text-left text-base text-foreground shadow-card transition-all duration-200 hover:border-success/40 hover:bg-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2.5 sm:text-sm"
      >
        <span className={selectedOption ? "font-medium" : "text-muted"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <CaretDown
          size={16}
          weight={AGENDA_ICON_WEIGHT}
          className="shrink-0 text-muted transition-transform duration-200"
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
          {searchable && (
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSearchQuery("");
                  onToggle();
                }
              }}
              placeholder={searchPlaceholder}
              className="mb-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-3 text-base font-medium text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:min-h-0 sm:py-2.5 sm:text-sm"
            />
          )}
          {selectedOption && onClear && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                onClear();
              }}
              className="mb-2 flex min-h-11 w-full items-center justify-between rounded-lg border border-danger/10 bg-danger/5 px-3 py-3 text-left text-base font-semibold text-danger transition-colors hover:bg-danger hover:text-white sm:min-h-0 sm:py-2.5 sm:text-sm"
            >
              {clearLabel}
              <X size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
            </button>
          )}
          {filteredOptions.length > 0 ? (
            <div role="listbox" aria-labelledby={id} className="space-y-1">
              {filteredOptions.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setSearchQuery("");
                      onSelect(option.value);
                    }}
                    className={`min-h-11 w-full rounded-lg px-3 py-3 text-left text-base transition-colors sm:min-h-0 sm:py-2.5 sm:text-sm ${
                      selected
                        ? "bg-success/10 text-success"
                        : "text-foreground hover:bg-background"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs text-muted">
                        {option.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-background px-3 py-2.5 text-sm text-muted">
              {options.length > 0 ? noResultsMessage : emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AgendaCalendar() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const linkedClientId = searchParams.get("clientId");
  const linkedClientHandledRef = useRef<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [now, setNow] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [agendaCapacity, setAgendaCapacity] = useState(DEFAULT_AGENDA_CAPACITY);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formClosing, setFormClosing] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [editingTotalAmount, setEditingTotalAmount] = useState(false);
  const [openSelectId, setOpenSelectId] = useState<AgendaSelectId | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [closingStatusMenuId, setClosingStatusMenuId] = useState<string | null>(
    null
  );
  const [focusedAppointmentId, setFocusedAppointmentId] = useState<string | null>(
    null
  );
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState<AppointmentForm>({
    date: dateKey(today),
    endDate: dateKey(today),
    isMultiDay: false,
    startTime: "",
    endTime: "",
    clientId: "",
    vehicleId: "",
    serviceIds: [],
    totalAmount: "",
  });
  const [error, setError] = useState<string | null>(null);

  const syncFinanceRevenueForAppointment = useCallback(async (appointment: Appointment) => {
    if (!workshopId || appointment.totalAmount <= 0) return null;

    const description = `${appointment.client} - ${
      appointment.service || "Serviço realizado"
    }`;
    const payload = {
      workshop_id: workshopId,
      type: "receita" as const,
      description,
      amount: appointment.totalAmount,
      category: "Serviço",
      service_order_id: appointment.id,
      transaction_date: appointment.date,
    };

    const { data: existingTransactions, error: findError } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("service_order_id", appointment.id)
      .eq("type", "receita")
      .limit(1);

    if (findError) return findError.message;

    const existingTransaction = existingTransactions?.[0];
    if (existingTransaction) {
      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update(payload)
        .eq("id", existingTransaction.id);

      return updateError?.message ?? null;
    }

    const { error: insertError } = await supabase
      .from("financial_transactions")
      .insert(payload);

    return insertError?.message ?? null;
  }, [supabase, workshopId]);

  const deleteFinanceRevenueForAppointment = useCallback(async (appointmentId: string) => {
    const { error: deleteError } = await supabase
      .from("financial_transactions")
      .delete()
      .eq("service_order_id", appointmentId)
      .eq("type", "receita");

    return deleteError?.message ?? null;
  }, [supabase]);

  const applySupabaseStockDiscountForAppointment = useCallback(
    async (appointment: Appointment) => {
      if (!workshopId) return;

      const { data: existingDiscount, error: findDiscountError } = await supabase
        .from("product_stock_discounts")
        .select("service_order_id")
        .eq("workshop_id", workshopId)
        .eq("service_order_id", appointment.id)
        .maybeSingle();

      if (findDiscountError || existingDiscount) return;

      const catalog = await loadSupabaseCatalog(supabase, workshopId);
      const usageByProductId = new Map<string, number>();

      appointment.serviceIds.forEach((serviceId) => {
        (catalog.serviceProductUsages[serviceId] ?? []).forEach((usage) => {
          try {
            const amount = parsePositiveNumber(usage.amount);
            usageByProductId.set(
              usage.productId,
              (usageByProductId.get(usage.productId) ?? 0) + amount
            );
          } catch {
            // Ignore incomplete service usage rows.
          }
        });
      });

      if (usageByProductId.size === 0) return;

      for (const product of catalog.products) {
        const discountAmount = usageByProductId.get(product.id);
        if (!discountAmount) continue;

        await saveSupabaseProduct(supabase, workshopId, {
          ...product,
          stockRemaining: String(
            Math.max(0, getProductRemainingStock(product) - discountAmount)
          ),
        });
      }

      await supabase.from("product_stock_discounts").insert({
        workshop_id: workshopId,
        service_order_id: appointment.id,
      });
    },
    [supabase, workshopId]
  );

  async function importLocalAppointmentsToSupabase(
    workshopId: string,
    remoteAppointments: Appointment[]
  ) {
    const localAppointments = readLocalAppointments();
    if (localAppointments.length === 0) return remoteAppointments;

    const existingKeys = new Set(
      remoteAppointments.map(
        (appointment) =>
          `${appointment.date}|${getAppointmentEndDate(appointment)}|${appointment.startTime}|${appointment.endTime}|${appointment.clientId}|${appointment.vehicleId}`
      )
    );
    const importedAppointments: Appointment[] = [];

    for (const appointment of localAppointments) {
      const appointmentKey = `${appointment.date}|${getAppointmentEndDate(appointment)}|${appointment.startTime}|${appointment.endTime}|${appointment.clientId}|${appointment.vehicleId}`;
      if (existingKeys.has(appointmentKey)) continue;

      const payload = {
        ...(isUuid(appointment.id) ? { id: appointment.id } : {}),
        workshop_id: workshopId,
        client_id: appointment.clientId,
        vehicle_id: appointment.vehicleId,
        total_amount: appointment.totalAmount,
        scheduled_date: appointment.date,
        scheduled_end_date: getAppointmentEndDate(appointment),
        scheduled_start: appointment.startTime,
        scheduled_end: appointment.endTime,
        status: getServiceOrderStatus(appointment.status),
        payment_status: "pendente",
        completed_at:
          appointment.status === "Concluído" ? new Date().toISOString() : null,
      };

      const { data: insertedOrder, error: insertError } = await supabase
        .from("service_orders")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      const savedAppointmentId = insertedOrder.id as string;
      if (appointment.serviceIds.length > 0) {
        const { error: itemsError } = await supabase
          .from("service_order_items")
          .insert(
            appointment.serviceIds.map((serviceId) => ({
              service_order_id: savedAppointmentId,
              service_id: serviceId,
              quantity: 1,
              unit_price: 0,
            }))
          );

        if (itemsError) throw itemsError;
      }

      importedAppointments.push({ ...appointment, id: savedAppointmentId });
      existingKeys.add(appointmentKey);
    }

    if (importedAppointments.length > 0) {
      clearLocalAppointments();
    }

    return [...remoteAppointments, ...importedAppointments];
  }

  async function loadAgendaData() {
    setLoadingClients(true);
    setLoadingServices(true);
    setLoadingAppointments(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (!profile?.workshop_id) {
      setLoadingClients(false);
      setLoadingServices(false);
      setLoadingAppointments(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

    const { data: workshopData, error: workshopError } = await supabase
      .from("workshops")
      .select("agenda_capacity")
      .eq("id", profile.workshop_id)
      .single();

    if (workshopError) {
      if (isMissingAgendaCapacityError(workshopError)) {
        setAgendaCapacity(DEFAULT_AGENDA_CAPACITY);
        setError(
          "A coluna agenda_capacity ainda não existe no Supabase. Aplique a migration 009."
        );
      } else {
        setError(workshopError.message);
      }
    } else {
      const localCapacity = readLocalAgendaCapacityForImport(profile.workshop_id);
      if (localCapacity !== null && localCapacity !== normalizeAgendaCapacity(workshopData?.agenda_capacity)) {
        const { error: capacityImportError } = await supabase
          .from("workshops")
          .update({ agenda_capacity: localCapacity })
          .eq("id", profile.workshop_id);

        if (!capacityImportError) {
          clearLocalAgendaCapacity(profile.workshop_id);
          setAgendaCapacity(localCapacity);
        } else {
          setAgendaCapacity(normalizeAgendaCapacity(workshopData?.agenda_capacity));
        }
      } else {
        if (localCapacity !== null) {
          clearLocalAgendaCapacity(profile.workshop_id);
        }
        setAgendaCapacity(normalizeAgendaCapacity(workshopData?.agenda_capacity));
      }
    }

    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select(
        "*, vehicles(id, client_id, brand, model, plate, year, photo_url_1, photo_url_2)"
      )
      .eq("workshop_id", profile.workshop_id)
      .order("name", { ascending: true });

    if (!clientsError) {
      setClients((clientsData as Client[]) ?? []);
    }

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, active")
      .eq("workshop_id", profile.workshop_id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (!servicesError) {
      setServices((servicesData as AgendaService[]) ?? []);
    }

    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("service_orders")
      .select(
        `
        id,
        client_id,
        vehicle_id,
        status,
        total_amount,
        scheduled_date,
        scheduled_end_date,
        scheduled_start,
        scheduled_end,
        clients(name),
        vehicles(brand, model, plate),
        service_order_items(
          service_id,
          unit_price,
          services(id, name, price, duration_minutes)
        )
      `
      )
      .eq("workshop_id", profile.workshop_id)
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_start", { ascending: true });

    if (appointmentsError) {
      const { data: legacyAppointmentsData, error: legacyAppointmentsError } =
        await supabase
          .from("service_orders")
          .select(
            `
            id,
            client_id,
            vehicle_id,
            status,
            total_amount,
            scheduled_date,
            scheduled_start,
            scheduled_end,
            clients(name),
            vehicles(brand, model, plate),
            service_order_items(
              service_id,
              unit_price,
              services(id, name, price, duration_minutes)
            )
          `
          )
          .eq("workshop_id", profile.workshop_id)
          .not("scheduled_date", "is", null)
          .order("scheduled_date", { ascending: true })
          .order("scheduled_start", { ascending: true });

      if (!legacyAppointmentsError) {
        const remoteAppointments =
          ((legacyAppointmentsData as (Omit<
            AppointmentOrderRow,
            "scheduled_end_date"
          > & { scheduled_end_date?: string | null })[] | null) ?? []).map(
            (appointment) =>
              mapOrderToAppointment({
                ...appointment,
                scheduled_end_date: appointment.scheduled_end_date ?? null,
              })
          );
        try {
          setAppointments(
            await importLocalAppointmentsToSupabase(
              profile.workshop_id,
              remoteAppointments
            )
          );
        } catch (err) {
          setAppointments(remoteAppointments);
          setError(
            err instanceof Error
              ? `Não foi possível importar agendamentos locais para o Supabase: ${err.message}`
              : "Não foi possível importar agendamentos locais para o Supabase."
          );
        }
        setError((current) =>
          current ??
            "A coluna scheduled_end_date ainda não existe no Supabase. Aplique a migration 010 para serviços de múltiplos dias."
        );
      } else if (isMissingAgendaMigrationError(legacyAppointmentsError)) {
        setAppointments([]);
        setError(
          "As colunas da Agenda ainda não existem no Supabase. Aplique as migrations da Agenda."
        );
      } else {
        setError(legacyAppointmentsError.message);
      }
    } else {
      const remoteAppointments =
        ((appointmentsData as AppointmentOrderRow[] | null) ?? []).map(
          mapOrderToAppointment
        );
      try {
        setAppointments(
          await importLocalAppointmentsToSupabase(profile.workshop_id, remoteAppointments)
        );
      } catch (err) {
        setAppointments(remoteAppointments);
        setError(
          err instanceof Error
            ? `Não foi possível importar agendamentos locais para o Supabase: ${err.message}`
            : "Não foi possível importar agendamentos locais para o Supabase."
        );
      }
    }

    setLoadingClients(false);
    setLoadingServices(false);
    setLoadingAppointments(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadAgendaData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextNow = new Date();
      setNow(nextNow);
      setAppointments((prev) => {
        const completedAppointmentIds: string[] = [];
        const completedAppointments: Appointment[] = [];
        const next = prev.map((appointment) => {
          if (
            appointment.status === "Confirmado" &&
            isAppointmentPast(appointment, nextNow)
          ) {
            completedAppointmentIds.push(appointment.id);
            completedAppointments.push(appointment);
            void applySupabaseStockDiscountForAppointment(appointment).catch((err) => {
              setError(
                err instanceof Error
                  ? `Estoque não sincronizou no Supabase: ${err.message}`
                  : "Estoque não sincronizou no Supabase."
              );
            });
            return { ...appointment, status: "Concluído" as const };
          }

          return appointment;
        });

        if (completedAppointmentIds.length > 0) {
          void supabase
            .from("service_orders")
            .update({
              status: "finalizada",
              completed_at: nextNow.toISOString(),
            })
            .in("id", completedAppointmentIds)
            .then(async ({ error: updateError }) => {
              if (updateError) {
                setError(updateError.message);
                return;
              }

              const financeErrors = await Promise.all(
                completedAppointments.map((appointment) =>
                  syncFinanceRevenueForAppointment(appointment)
                )
              );
              const financeError = financeErrors.find(Boolean);
              if (financeError) setError(financeError);
            });
        }

        return completedAppointmentIds.length > 0 ? next : prev;
      });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [
    applySupabaseStockDiscountForAppointment,
    supabase,
    syncFinanceRevenueForAppointment,
  ]);

  const selectedKey = dateKey(selectedDate);
  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth]
  );
  const normalizedAppointments = useMemo(() => {
    return appointments.map((appointment) =>
      appointment.status === "Confirmado" && isAppointmentPast(appointment, now)
        ? { ...appointment, status: "Concluído" as const }
        : appointment
    );
  }, [appointments, now]);
  const appointmentsByDate = useMemo(() => {
    return normalizedAppointments.reduce<Record<string, AppointmentOccurrence[]>>(
      (acc, appointment) => {
        const endDate = getAppointmentEndDate(appointment);
        const dateRange = getDateRangeKeys(appointment.date, endDate);
        const durationDays = dateRange.length;

        dateRange.forEach((occurrenceDate, index) => {
          const occurrence: AppointmentOccurrence = {
            ...appointment,
            occurrenceDate,
            isMultiDay: durationDays > 1,
            isContinuation: index > 0,
            isFirstDay: index === 0,
            isLastDay: index === dateRange.length - 1,
            durationDays,
          };

          acc[occurrenceDate] = [...(acc[occurrenceDate] ?? []), occurrence];
        });

        return acc;
      },
      {}
    );
  }, [normalizedAppointments]);
  const selectedAppointments = (appointmentsByDate[selectedKey] ?? []).sort(
    (a, b) => a.startTime.localeCompare(b.startTime)
  );
  const selectedAppointmentGroups = selectedAppointments.reduce<
    { time: string; appointments: AppointmentOccurrence[] }[]
  >((groups, appointment) => {
    const currentGroup = groups.find((group) => group.time === appointment.startTime);

    if (currentGroup) {
      currentGroup.appointments.push(appointment);
      return groups;
    }

    return [...groups, { time: appointment.startTime, appointments: [appointment] }];
  }, []);
  const selectedTimelineLaneCount = Math.max(
    1,
    Math.max(
      ...timeSlots.map(
        (time) =>
          selectedAppointments.filter((appointment) =>
            isTimeInRange(time, appointment.startTime, appointment.endTime)
          ).length
      )
    )
  );
  const currentDateKey = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const selectedDateIsToday = selectedKey === currentDateKey;
  const occupancyTitle = selectedDateIsToday ? "Ocupação hoje" : "Ocupação do dia";
  const timelineBlocks = (() => {
    const laneEnds: string[] = [];

    return [...selectedAppointments]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((appointment, index, dayAppointments) => {
        const availableLaneIndex = laneEnds.findIndex(
          (endTime) => timeToMinutes(endTime) <= timeToMinutes(appointment.startTime)
        );
        const laneIndex =
          availableLaneIndex >= 0 ? availableLaneIndex : laneEnds.length;
        laneEnds[laneIndex] = appointment.endTime;
      const start =
        ((timeToMinutes(appointment.startTime) -
          timeToMinutes(BUSINESS_START_TIME)) /
          (timeToMinutes(BUSINESS_END_TIME) -
            timeToMinutes(BUSINESS_START_TIME))) *
        100;
      const width =
        ((timeToMinutes(appointment.endTime) -
          timeToMinutes(appointment.startTime)) /
          (timeToMinutes(BUSINESS_END_TIME) -
            timeToMinutes(BUSINESS_START_TIME))) *
        100;
      const connectsStart =
        index > 0 && dayAppointments[index - 1].endTime === appointment.startTime;
      const connectsEnd =
        index < dayAppointments.length - 1 &&
        appointment.endTime === dayAppointments[index + 1].startTime;
      const roundedClass =
        connectsStart && connectsEnd
          ? "rounded-none"
          : connectsStart
            ? "rounded-l-none rounded-r-full"
            : connectsEnd
              ? "rounded-l-full rounded-r-none"
              : "rounded-full";

      return {
        appointment,
        laneIndex,
        roundedClass,
        start: Math.max(0, Math.min(start, 100)),
        width: Math.max(0, Math.min(width, 100 - start)),
      };
      });
  })();
  const timelineMarkers = ["07h", "09h", "11h", "13h", "15h", "17h", "19h"];
  const selectedStatusCounts = appointmentStatuses.map((status) => ({
    status,
    count: selectedAppointments.filter((appointment) => appointment.status === status)
      .length,
  }));
  const focusedAppointment =
    selectedAppointments.find((appointment) => appointment.id === focusedAppointmentId) ??
    null;
  const automaticNextAppointment =
    selectedAppointments
      .filter(
        (appointment) =>
          (appointment.status === "Pendente" ||
            appointment.status === "Confirmado") &&
          (selectedKey !== currentDateKey ||
            timeToMinutes(appointment.endTime) > timeToMinutes(currentTime))
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  const nextAppointment = focusedAppointment ?? automaticNextAppointment;
  const nextAppointmentStyle = nextAppointment
    ? getStatusStyle(nextAppointment.status)
    : null;
  const nextAppointmentServices = nextAppointment?.service
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean) ?? [];
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectedClientVehicles = selectedClient?.vehicles ?? [];
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.name,
    description: client.phone || "Cliente cadastrado",
  }));
  const vehicleOptions = selectedClientVehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.brand} ${vehicle.model}`,
    description: `${vehicle.plate}${vehicle.year ? ` • ${vehicle.year}` : ""}`,
  }));
  const selectedServices = services.filter((service) =>
    form.serviceIds.includes(service.id)
  );
  const availableServices = services.filter(
    (service) => !form.serviceIds.includes(service.id)
  );
  const availableServiceOptions = availableServices.map((service) => {
    const duration = formatServiceDuration(service.duration_minutes);
    const details = [
      duration,
      getServicePrice(service) > 0 ? formatCurrency(getServicePrice(service)) : null,
    ].filter(Boolean);

    return {
      value: service.id,
      label: service.name,
      description: details.length > 0 ? details.join(" • ") : "Serviço cadastrado",
    };
  });
  const servicesTotal = selectedServices.reduce(
    (total, service) => total + getServicePrice(service),
    0
  );
  const customTotalAmount = Number(form.totalAmount.replace(",", "."));
  const hasCustomTotalAmount = form.totalAmount.trim() !== "";
  const displayTotalAmount =
    hasCustomTotalAmount && !Number.isNaN(customTotalAmount)
      ? customTotalAmount
      : servicesTotal;

  function startEditingTotalAmount() {
    setForm((prev) => {
      const current =
        hasCustomTotalAmount && !Number.isNaN(customTotalAmount)
          ? prev.totalAmount
          : servicesTotal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });

      return { ...prev, totalAmount: current };
    });
    setEditingTotalAmount(true);
  }

  function saveTotalAmount() {
    const normalized = form.totalAmount.trim().replace(/\./g, "").replace(",", ".");
    const amount = Number(normalized);

    if (!form.totalAmount.trim() || !Number.isFinite(amount) || amount < 0) {
      setError("Informe um valor válido para o total dos serviços.");
      return;
    }

    setForm((prev) => ({ ...prev, totalAmount: String(amount) }));
    setEditingTotalAmount(false);
    setError(null);
  }

  function resetTotalAmountToServicesSum() {
    setForm((prev) => ({ ...prev, totalAmount: "" }));
    setEditingTotalAmount(false);
    setError(null);
  }
  const slotOccupancyForFormDate = useMemo(() => {
    const appointmentsForDate = appointments.filter(
      (appointment) =>
        appointmentOccursOnDate(appointment, form.date) &&
        appointment.id !== editingAppointmentId
    );

    return timeSlots.reduce<Map<string, number>>((acc, time) => {
      const count = appointmentsForDate.filter((appointment) =>
        isTimeInRange(time, appointment.startTime, appointment.endTime)
      ).length;

      acc.set(time, count);
      return acc;
    }, new Map());
  }, [appointments, editingAppointmentId, form.date]);

  function resetForm() {
    setForm({
      date: selectedKey,
      endDate: selectedKey,
      isMultiDay: false,
      startTime: "",
      endTime: "",
      clientId: "",
      vehicleId: "",
      serviceIds: [],
      totalAmount: "",
    });
    setError(null);
    setAddingService(false);
    setEditingTotalAmount(false);
    setOpenSelectId(null);
  }

  function openCreateForm() {
    resetForm();
    setEditingAppointmentId(null);
    setFormClosing(false);
    setCreating(true);
  }

  useEffect(() => {
    if (
      !linkedClientId ||
      loadingClients ||
      linkedClientHandledRef.current === linkedClientId
    ) {
      return;
    }

    const linkedClient = clients.find((client) => client.id === linkedClientId);
    if (!linkedClient) return;

    void Promise.resolve().then(() => {
      const targetDate = new Date();
      const targetKey = dateKey(targetDate);

      linkedClientHandledRef.current = linkedClientId;
      setCurrentMonth(startOfMonth(targetDate));
      setSelectedDate(targetDate);
      setFocusedAppointmentId(null);
      setDayDrawerOpen(true);
      setEditingAppointmentId(null);
      setForm({
        date: targetKey,
        endDate: targetKey,
        isMultiDay: false,
        startTime: "",
        endTime: "",
        clientId: linkedClient.id,
        vehicleId: linkedClient.vehicles?.[0]?.id ?? "",
        serviceIds: [],
        totalAmount: "",
      });
      setError(null);
      setAddingService(false);
      setEditingTotalAmount(false);
      setOpenSelectId(null);
      setFormClosing(false);
      setCreating(true);
    });
  }, [clients, linkedClientId, loadingClients]);

  function openEditForm(appointment: Appointment) {
    setOpenStatusMenuId(null);
    const appointmentEndDate = getAppointmentEndDate(appointment);
    setForm({
      date: appointment.date,
      endDate: appointmentEndDate,
      isMultiDay: appointmentEndDate !== appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      clientId: appointment.clientId,
      vehicleId: appointment.vehicleId,
      serviceIds: appointment.serviceIds,
      totalAmount:
        appointment.totalAmount > 0 ? String(appointment.totalAmount) : "",
    });
    setEditingAppointmentId(appointment.id);
    setError(null);
    setCreating(true);
    setAddingService(false);
    setEditingTotalAmount(false);
    setFormClosing(false);
    setOpenSelectId(null);
  }

  function addServiceToForm(serviceId: string) {
    if (!serviceId) return;

    setForm((prev) =>
      prev.serviceIds.includes(serviceId)
        ? prev
        : { ...prev, serviceIds: [...prev.serviceIds, serviceId] }
    );
    setAddingService(false);
    setOpenSelectId(null);
  }

  function removeServiceFromForm(serviceId: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.filter((id) => id !== serviceId),
    }));
  }

  function hasAppointmentConflict(
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string
  ) {
    return getDateRangeKeys(startDate, endDate).some((date) => {
      const appointmentsForDate = appointments.filter(
        (appointment) =>
          appointmentOccursOnDate(appointment, date) &&
          appointment.id !== editingAppointmentId &&
          rangesOverlap(startTime, endTime, appointment.startTime, appointment.endTime)
      );

      return timeSlots
        .filter((time) => isTimeInRange(time, startTime, endTime))
        .some((time) => {
          const occupiedCount = appointmentsForDate.filter((appointment) =>
            isTimeInRange(time, appointment.startTime, appointment.endTime)
          ).length;

          return occupiedCount >= agendaCapacity;
        });
    });
  }

  function selectTimeSlot(time: string) {
    setError(null);

    if (
      !form.startTime ||
      form.endTime ||
      timeToMinutes(time) <= timeToMinutes(form.startTime)
    ) {
      setForm((prev) => ({ ...prev, startTime: time, endTime: "" }));
      return;
    }

    const formEndDate = form.isMultiDay ? form.endDate : form.date;
    if (hasAppointmentConflict(form.date, formEndDate, form.startTime, time)) {
      setError("Capacidade máxima atingida para esse intervalo.");
      return;
    }

    setForm((prev) => ({ ...prev, endTime: time }));
  }

  function closeForm() {
    setOpenSelectId(null);
    setFormClosing(true);

    window.setTimeout(() => {
      resetForm();
      setEditingAppointmentId(null);
      setCreating(false);
      setFormClosing(false);
    }, 220);
  }

  function syncSelectedDate(date: string) {
    const nextDate = new Date(`${date}T00:00:00`);
    setFocusedAppointmentId(null);
    setSelectedDate(nextDate);
    setCurrentMonth(startOfMonth(nextDate));
  }

  function selectCalendarDate(day: Date) {
    const key = dateKey(day);
    setFocusedAppointmentId(null);
    setSelectedDate(day);
    setDayDrawerOpen(true);

    if (creating) {
      setForm((prev) => ({
        ...prev,
        date: key,
        endDate: prev.isMultiDay && prev.endDate >= key ? prev.endDate : key,
      }));
    }
  }

  async function handleSaveAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    if (
      !form.date ||
      (form.isMultiDay && !form.endDate) ||
      !form.startTime ||
      !form.endTime ||
      !form.clientId ||
      !form.vehicleId ||
      form.serviceIds.length === 0
    ) {
      setError("Informe data, começo, final, cliente, veículo e serviço.");
      return;
    }

    const appointmentEndDate = form.isMultiDay ? form.endDate : form.date;
    if (appointmentEndDate < form.date || (form.isMultiDay && appointmentEndDate === form.date)) {
      setError("A data de término precisa ser depois da data de início.");
      return;
    }

    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      setError("O horário final precisa ser depois do começo.");
      return;
    }

    if (
      hasCustomTotalAmount &&
      (Number.isNaN(customTotalAmount) || customTotalAmount < 0)
    ) {
      setError("Informe um valor válido para o total.");
      return;
    }

    if (
      hasAppointmentConflict(
        form.date,
        appointmentEndDate,
        form.startTime,
        form.endTime
      )
    ) {
      setError("Capacidade máxima atingida para esse intervalo.");
      return;
    }

    const appointmentClient = clients.find(
      (client) => client.id === form.clientId
    );
    const appointmentVehicle = appointmentClient?.vehicles?.find(
      (vehicle) => vehicle.id === form.vehicleId
    );

    if (!appointmentClient || !appointmentVehicle || selectedServices.length === 0) {
      setError("Selecione cliente, veículo e serviço válidos.");
      return;
    }

    const vehicleLabel = `${appointmentVehicle.brand} ${appointmentVehicle.model} - ${appointmentVehicle.plate}`;
    const serviceLabel = selectedServices.map((service) => service.name).join(", ");
    const appointmentTotal = hasCustomTotalAmount
      ? customTotalAmount
      : servicesTotal;
    const currentStatus =
      appointments.find((appointment) => appointment.id === editingAppointmentId)
        ?.status ?? "Pendente";
    const payload = {
      client_id: appointmentClient.id,
      vehicle_id: appointmentVehicle.id,
      total_amount: appointmentTotal,
      scheduled_date: form.date,
      scheduled_end_date: appointmentEndDate,
      scheduled_start: form.startTime,
      scheduled_end: form.endTime,
      status: getServiceOrderStatus(currentStatus),
      completed_at:
        currentStatus === "Concluído" ? new Date().toISOString() : null,
    };
    const serviceItems = selectedServices.map((service) => ({
      service_id: service.id,
      quantity: 1,
      unit_price: getServicePrice(service),
    }));

    setSavingAppointment(true);
    setError(null);

    try {
      let savedAppointmentId = editingAppointmentId;

      if (editingAppointmentId) {
        const { error: updateError } = await supabase
          .from("service_orders")
          .update(payload)
          .eq("id", editingAppointmentId);

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from("service_order_items")
          .delete()
          .eq("service_order_id", editingAppointmentId);

        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data: insertedOrder, error: insertError } = await supabase
          .from("service_orders")
          .insert({
            ...payload,
            workshop_id: workshopId,
            payment_status: "pendente",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        savedAppointmentId = insertedOrder.id;
      }

      if (!savedAppointmentId) {
        throw new Error("Erro ao salvar agendamento.");
      }

      const { error: insertItemsError } = await supabase
        .from("service_order_items")
        .insert(
          serviceItems.map((item) => ({
            ...item,
            service_order_id: savedAppointmentId,
          }))
        );

      if (insertItemsError) throw insertItemsError;

      const savedAppointment: Appointment = {
        id: savedAppointmentId,
        date: form.date,
        endDate: appointmentEndDate,
        startTime: form.startTime,
        endTime: form.endTime,
        clientId: appointmentClient.id,
        vehicleId: appointmentVehicle.id,
        serviceIds: selectedServices.map((service) => service.id),
        client: appointmentClient.name,
        service: serviceLabel,
        totalAmount: appointmentTotal,
        vehicle: vehicleLabel,
        status: currentStatus,
      };

      setAppointments((prev) =>
        editingAppointmentId
          ? prev.map((appointment) =>
              appointment.id === editingAppointmentId
                ? savedAppointment
                : appointment
            )
          : [...prev, savedAppointment]
      );
      if (savedAppointment.status === "Concluído") {
        const financeError = await syncFinanceRevenueForAppointment(savedAppointment);
        if (financeError) {
          setError(financeError);
        }
      }
      syncSelectedDate(form.date);
      closeForm();
    } catch (err) {
      if (isMissingAgendaMigrationError(err)) {
        setError(
          "Supabase da Agenda não está pronto. Aplique as migrations antes de salvar novos agendamentos."
        );
        return;
      }

      setError(
        err instanceof Error ? err.message : "Erro ao salvar agendamento."
      );
    } finally {
      setSavingAppointment(false);
    }
  }

  async function handleDeleteAppointment(appointment: Appointment) {
    setOpenStatusMenuId(null);
    const confirmed = window.confirm(
      `Deseja excluir o horário de ${appointment.client}?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("service_orders")
      .delete()
      .eq("id", appointment.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setAppointments((prev) =>
      prev.filter((item) => item.id !== appointment.id)
    );

    if (editingAppointmentId === appointment.id) {
      closeForm();
    }
  }

  async function handleClearSelectedDay() {
    setOpenStatusMenuId(null);
    const confirmed = window.confirm(
      "Deseja excluir todos os horários deste dia?"
    );

    if (!confirmed) return;

    const appointmentIds = selectedAppointments.map((appointment) => appointment.id);

    if (appointmentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("service_orders")
        .delete()
        .in("id", appointmentIds);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }

    setAppointments((prev) =>
      prev.filter((appointment) => appointment.date !== selectedKey)
    );
    closeForm();
  }

  async function handleChangeStatus(
    appointmentId: string,
    status: AppointmentStatus
  ) {
    const currentAppointment = appointments.find(
      (appointment) => appointment.id === appointmentId
    );
    const shouldDiscountStock =
      status === "Concluído" && currentAppointment?.status !== "Concluído";
    const shouldRemoveFinanceRevenue =
      status !== "Concluído" && currentAppointment?.status === "Concluído";

    const { error: updateError } = await supabase
      .from("service_orders")
      .update({
        status: getServiceOrderStatus(status),
        completed_at: status === "Concluído" ? new Date().toISOString() : null,
      })
      .eq("id", appointmentId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (currentAppointment && status === "Concluído") {
      const financeError = await syncFinanceRevenueForAppointment(currentAppointment);
      if (financeError) {
        setError(financeError);
      }
    }

    if (shouldRemoveFinanceRevenue) {
      const financeError = await deleteFinanceRevenueForAppointment(appointmentId);
      if (financeError) {
        setError(financeError);
      }
    }

    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status }
          : appointment
      )
    );
    if (currentAppointment && shouldDiscountStock) {
      void applySupabaseStockDiscountForAppointment(currentAppointment).catch((err) => {
        setError(
          err instanceof Error
            ? `Estoque não sincronizou no Supabase: ${err.message}`
            : "Estoque não sincronizou no Supabase."
        );
      });
    }
    closeStatusMenu(appointmentId);
  }

  function toggleStatusMenu(appointmentId: string) {
    if (openStatusMenuId === appointmentId) {
      closeStatusMenu(appointmentId);
      return;
    }

    setClosingStatusMenuId(null);
    setOpenStatusMenuId(appointmentId);
  }

  function closeStatusMenu(appointmentId: string) {
    setOpenStatusMenuId(null);
    setClosingStatusMenuId(appointmentId);

    window.setTimeout(() => {
      setClosingStatusMenuId((current) =>
        current === appointmentId ? null : current
      );
    }, 180);
  }

  async function handleCreateClient(data: ClientFormData) {
    if (!workshopId) {
      throw new Error("Oficina não encontrada.");
    }

    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: data.name.trim(),
        phone: normalizePhone(data.phone),
        notes: data.notes.trim() || null,
        workshop_id: workshopId,
      })
      .select("id")
      .single();

    if (clientError) {
      throw new Error(clientError.message);
    }

    await syncVehicles(supabase, workshopId, newClient.id, data.vehicles);

    const { data: savedClient, error: savedClientError } = await supabase
      .from("clients")
      .select(
        "*, vehicles(id, client_id, brand, model, plate, year, photo_url_1, photo_url_2)"
      )
      .eq("id", newClient.id)
      .single();

    if (savedClientError) {
      throw new Error(savedClientError.message);
    }

    const client = savedClient as Client;
    setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((prev) => ({
      ...prev,
      clientId: client.id,
      vehicleId: client.vehicles?.[0]?.id ?? "",
    }));
    setOpenSelectId(null);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-muted">
                <CalendarBlank
                  size={18}
                  weight={AGENDA_ICON_WEIGHT}
                  className="shrink-0"
                  aria-hidden
                />
                {occupancyTitle}
              </p>
              <div
                className="timeline-track-loading relative mt-4 overflow-hidden rounded-lg bg-border shadow-inner"
                style={{
                  height: `${Math.max(1, selectedTimelineLaneCount) * 1.75}rem`,
                }}
              >
                {timelineBlocks.map(({ appointment, laneIndex, roundedClass, start, width }, index) => {
                  const style = getStatusStyle(appointment.status);
                  const laneHeight = 100 / selectedTimelineLaneCount;

                  return (
                    <button
                      type="button"
                      key={`${appointment.id}-${appointment.status}`}
                      onClick={() => setFocusedAppointmentId(appointment.id)}
                      title={`${appointment.startTime} - ${appointment.endTime} • ${appointment.client} • ${appointment.service}`}
                      aria-label={`Mostrar ${appointment.client} no próximo cliente`}
                      className={`timeline-block-loading timeline-service-hover absolute cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/80 ${roundedClass} ${style.timelineBlock}`}
                      style={{
                        left: `${start}%`,
                        width: `${width}%`,
                        top: `${laneIndex * laneHeight}%`,
                        height: `calc(${laneHeight}% - 2px)`,
                        animationDelay: `${index * 70}ms`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium text-muted">
                {timelineMarkers.map((marker) => (
                  <span key={marker}>{marker}</span>
                ))}
              </div>
              {selectedAppointments.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedStatusCounts
                    .filter(({ count }) => count > 0)
                    .map(({ status, count }) => {
                      const style = getStatusStyle(status);

                      return (
                        <span
                          key={status}
                          className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted"
                        >
                          {status !== "Concluído" && (
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${style.timelineBlock}`}
                            />
                          )}
                          <span className="inline-flex items-center gap-1">
                            <AppointmentStatusLabel status={status} iconSize={12} />
                            <span>: {count}</span>
                          </span>
                        </span>
                      );
                    })}
                </div>
              ) : null}
              <p className="mt-3 text-sm font-medium text-foreground">
                {formatAppointmentCount(selectedAppointments.length)}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg border-l-4 bg-card p-4 shadow-card sm:p-6 ${
            nextAppointmentStyle?.sideAccent ?? "border-l-border"
          }`}
        >
          <div className="flex min-h-[10.5rem] flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted">Próximo cliente</p>
              {nextAppointment ? (
                <>
                  <p className="mt-2 currency-display leading-tight text-foreground sm:text-3xl">
                    {nextAppointment.client}
                  </p>
                  <div className="mt-3 flex min-h-[1.75rem] flex-wrap gap-2">
                    {nextAppointmentServices.map((service) => (
                      <span
                        key={service}
                        className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <Car size={16} weight={AGENDA_ICON_WEIGHT} className="shrink-0" aria-hidden />
                    <span>{nextAppointment.vehicle}</span>
                  </p>
                  {nextAppointment.isMultiDay && (
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {formatAppointmentDuration(nextAppointment)}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-4 flex flex-col items-center justify-center py-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/10 text-muted/50">
                    <CalendarX
                      size={20}
                      weight={AGENDA_ICON_WEIGHT}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-3 text-sm font-medium text-muted">
                    Nenhum agendamento pendente
                  </p>
                  <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted/70">
                    Aproveite para organizar sua agenda
                  </p>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              {nextAppointment && (
                <>
                  <span
                    className={`w-full whitespace-nowrap rounded-lg px-5 py-4 text-center text-xl font-bold leading-tight shadow-card sm:min-w-44 ${nextAppointmentStyle?.timeBadge}`}
                  >
                    {nextAppointment.startTime} - {nextAppointment.endTime}
                  </span>
                  <div className="flex w-full flex-col items-start gap-2 sm:items-end">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${nextAppointmentStyle?.statusBadge}`}
                    >
                      {nextAppointment.status !== "Concluído" && (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                      <AppointmentStatusLabel status={nextAppointment.status} />
                    </span>

                    <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto">
                      {appointmentStatuses.map((status) => {
                        const optionStyle = getStatusStyle(status);
                        const isCurrentStatus = nextAppointment.status === status;

                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={isCurrentStatus}
                            onClick={() =>
                              handleChangeStatus(nextAppointment.id, status)
                            }
                            className={`min-h-9 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all sm:min-h-0 ${
                              isCurrentStatus
                                ? "cursor-default border-current opacity-60"
                                : "border-transparent hover:-translate-y-0.5 hover:shadow-card"
                            } ${optionStyle.statusBadge}`}
                          >
                            <AppointmentStatusLabel status={status} iconSize={12} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 md:mt-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="self-start rounded-lg border border-border bg-card shadow-card shadow-card">
          <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-semibold capitalize text-foreground">
                {formatMonthTitle(currentMonth)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Clique em um dia para ver ou organizar os horários.
              </p>
            </div>

            <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-background p-2 text-muted transition-colors hover:text-foreground sm:min-h-0"
                aria-label="Mês anterior"
              >
                <CaretLeft size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(startOfMonth(today));
                  selectCalendarDate(today);
                }}
                className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base font-medium text-foreground transition-colors hover:border-accent sm:min-h-0 sm:text-sm"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-background p-2 text-muted transition-colors hover:text-foreground sm:min-h-0"
                aria-label="Próximo mês"
              >
                <CaretRight size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-background/60 px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted sm:px-4 sm:text-xs">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 p-2 sm:gap-2 sm:p-4">
            {calendarDays.map((day, index) => {
              const key = dateKey(day);
              const dayAppointments = (appointmentsByDate[key] ?? []).sort((a, b) =>
                a.startTime.localeCompare(b.startTime)
              );
              const visibleAppointments = dayAppointments.slice(0, 2);
              const hiddenAppointmentsCount = Math.max(
                dayAppointments.length - visibleAppointments.length,
                0
              );
              const isSelected = key === selectedKey;
              const isToday = key === dateKey(today);

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => selectCalendarDate(day)}
                  style={index === 0 ? { gridColumnStart: day.getDay() + 1 } : undefined}
                  className={`flex min-h-14 flex-col items-start rounded-lg border p-1 text-left transition-colors sm:min-h-24 sm:p-2 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-card"
                      : "border-transparent hover:border-border hover:bg-background"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:h-6 sm:w-6 ${
                        isToday ? "bg-success text-white" : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-success/10 px-1.5 text-[10px] font-bold text-success sm:hidden">
                        {dayAppointments.length}
                      </span>
                    )}
                  </div>

                  {dayAppointments.length > 0 && (
                    <div className="mt-2 hidden w-full flex-col items-start gap-0.5 sm:flex">
                      {visibleAppointments.map((appointment) => {
                        const style = getStatusStyle(appointment.status);
                        const multiDayClass = appointment.isMultiDay
                          ? appointment.isFirstDay
                            ? "calendar-multiday-pill calendar-multiday-start"
                            : appointment.isLastDay
                              ? "calendar-multiday-pill calendar-multiday-end"
                              : "calendar-multiday-pill calendar-multiday-middle"
                          : "";

                        return (
                          <span
                            key={appointment.id}
                            className={`calendar-appointment-pill ${style.calendarPill} ${multiDayClass}`}
                            title={`${appointment.startTime} - ${appointment.endTime} • ${appointment.client}${appointment.isMultiDay ? ` • ${formatAppointmentDuration(appointment)}` : ""}`}
                          >
                            {appointment.isContinuation ? (
                              <>
                                <span className="calendar-pill-label">
                                  {appointment.startTime} (continuação)
                                </span>
                              </>
                            ) : (
                              <span className="calendar-pill-label">
                                {appointment.startTime}{" "}
                                {getShortClientName(appointment.client)}
                              </span>
                            )}
                          </span>
                        );
                      })}

                      {hiddenAppointmentsCount > 0 && (
                        <span className="calendar-appointment-pill calendar-more-pill">
                          +{hiddenAppointmentsCount} mais
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {dayDrawerOpen && (
          <button
            type="button"
            aria-label="Fechar detalhes do dia"
            className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
            onClick={() => setDayDrawerOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl transition-transform duration-300 md:static md:z-auto md:max-h-none md:translate-y-0 md:overflow-visible md:rounded-lg md:shadow-card ${
            dayDrawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Dia selecionado
            </p>
            <h2 className="mt-1 text-lg font-semibold capitalize text-foreground">
              {formatLongDate(selectedDate)}
            </h2>
            </div>
            <button
              type="button"
              onClick={() => setDayDrawerOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-background text-muted transition-colors hover:text-foreground md:hidden"
              aria-label="Fechar painel do dia"
            >
              <X size={20} weight={AGENDA_ICON_WEIGHT} aria-hidden />
            </button>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <Button
              variant="success"
              className="w-full"
              onClick={openCreateForm}
            >
              <Plus size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
              Novo agendamento
            </Button>

            {selectedAppointments.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelectedDay}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-base font-medium text-danger transition-colors hover:bg-danger hover:text-white sm:min-h-0 sm:py-2.5 sm:text-sm"
              >
                <Trash size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                Remover agendamentos do dia
              </button>
            )}

            {creating && (
              <form
                onSubmit={handleSaveAppointment}
                className={`space-y-4 rounded-lg border border-border bg-background shadow-card p-4 ${
                  formClosing ? "agenda-form-exit" : "agenda-form-enter"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {editingAppointmentId ? "Editar horário" : "Novo horário"}
                  </h3>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-foreground sm:min-h-0 sm:min-w-0 sm:p-1"
                    aria-label="Fechar formulário"
                  >
                    <X size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                  </button>
                </div>
                <Input
                  label="Data"
                  type="date"
                  value={form.date}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      date: nextDate,
                      endDate:
                        prev.isMultiDay && prev.endDate >= nextDate
                          ? prev.endDate
                          : nextDate,
                    }));
                    if (nextDate) syncSelectedDate(nextDate);
                  }}
                />
                <div className="rounded-lg border border-border bg-card shadow-card px-4 py-3 shadow-card">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isMultiDay: !prev.isMultiDay,
                        endDate: !prev.isMultiDay ? prev.endDate || prev.date : prev.date,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        Serviço de múltiplos dias
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        O horário de início e fim será aplicado a todos os dias do período.
                      </span>
                    </span>
                    <span
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                        form.isMultiDay ? "bg-success" : "bg-muted/20"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-white shadow-card transition-transform ${
                          form.isMultiDay ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                  {form.isMultiDay && (
                    <div className="mt-3">
                      <Input
                        label="Data de término"
                        type="date"
                        min={form.date}
                        value={form.endDate}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="agenda-client"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Cliente
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSelectId(null);
                        setClientModalOpen(true);
                      }}
                      className="min-h-11 text-sm font-semibold text-success transition-colors hover:text-success/80 sm:min-h-0 sm:text-xs"
                    >
                      Novo cliente
                    </button>
                  </div>
                  <AgendaDropdown
                    id="agenda-client"
                    value={form.clientId}
                    placeholder={
                      loadingClients
                        ? "Carregando clientes..."
                        : "Selecione um cliente"
                    }
                    emptyMessage="Nenhum cliente cadastrado."
                    options={clientOptions}
                    disabled={loadingClients}
                    open={openSelectId === "client"}
                    searchable
                    searchPlaceholder="Digite nome ou telefone"
                    noResultsMessage="Nenhum cliente encontrado."
                    onToggle={() =>
                      setOpenSelectId((current) =>
                        current === "client" ? null : "client"
                      )
                    }
                    onSelect={(value) => {
                      setForm((prev) => ({
                        ...prev,
                        clientId: value,
                        vehicleId: "",
                      }));
                      setOpenSelectId(null);
                    }}
                    clearLabel="Limpar cliente"
                    onClear={() => {
                      setForm((prev) => ({
                        ...prev,
                        clientId: "",
                        vehicleId: "",
                      }));
                      setOpenSelectId(null);
                    }}
                  />
                  {!loadingClients && clients.length === 0 && (
                    <p className="text-xs text-muted">
                      Nenhum cliente cadastrado. Use Novo cliente para criar.
                    </p>
                  )}
                </div>
                <div className="space-y-2.5">
                  <label
                    htmlFor="agenda-vehicle"
                    className="block text-sm font-semibold text-foreground"
                  >
                    Veículo
                  </label>
                  <AgendaDropdown
                    id="agenda-vehicle"
                    value={form.vehicleId}
                    placeholder={
                      !form.clientId
                        ? "Selecione um cliente primeiro"
                        : selectedClientVehicles.length === 0
                          ? "Cliente sem veículo cadastrado"
                          : "Selecione um veículo"
                    }
                    emptyMessage={
                      !form.clientId
                        ? "Selecione um cliente primeiro."
                        : "Cliente sem veículo cadastrado."
                    }
                    options={vehicleOptions}
                    disabled={
                      !form.clientId || selectedClientVehicles.length === 0
                    }
                    open={openSelectId === "vehicle"}
                    onToggle={() =>
                      setOpenSelectId((current) =>
                        current === "vehicle" ? null : "vehicle"
                      )
                    }
                    onSelect={(value) => {
                      setForm((prev) => ({
                        ...prev,
                        vehicleId: value,
                      }));
                      setOpenSelectId(null);
                    }}
                    clearLabel="Limpar veículo"
                    onClear={() => {
                      setForm((prev) => ({
                        ...prev,
                        vehicleId: "",
                      }));
                      setOpenSelectId(null);
                    }}
                  />
                  {form.clientId && selectedClientVehicles.length === 0 && (
                    <p className="text-xs text-muted">
                      Cadastre um veículo para este cliente antes de agendar.
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Serviços
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingService(true);
                        setOpenSelectId("service");
                      }}
                      disabled={
                        loadingServices ||
                        services.length === 0 ||
                        availableServices.length === 0
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-success/10 px-3 py-2 text-sm font-semibold text-success transition-all duration-200 hover:bg-success hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
                    >
                      <Plus size={14} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                      Adicionar serviço
                    </button>
                  </div>

                  <div className="min-h-[2.75rem]">
                    {selectedServices.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedServices.map((service) => (
                          <span
                            key={service.id}
                            className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success shadow-card"
                          >
                            {service.name}
                            <button
                              type="button"
                              onClick={() => removeServiceFromForm(service.id)}
                              className="rounded-full p-1 transition-colors hover:bg-success/20"
                              aria-label={`Remover ${service.name}`}
                            >
                              <X size={12} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {addingService && (
                    <AgendaDropdown
                      id="agenda-service"
                      value=""
                      placeholder={
                        loadingServices
                          ? "Carregando serviços..."
                          : availableServices.length === 0
                            ? "Todos os serviços já adicionados"
                            : "Selecione um serviço"
                      }
                      emptyMessage="Todos os serviços já foram adicionados."
                      options={availableServiceOptions}
                      disabled={loadingServices || availableServices.length === 0}
                      open={openSelectId === "service"}
                      onToggle={() =>
                        setOpenSelectId((current) =>
                          current === "service" ? null : "service"
                        )
                      }
                      onSelect={addServiceToForm}
                    />
                  )}

                  {!loadingServices && services.length === 0 && (
                    <p className="text-xs text-muted">
                      Cadastre serviços na aba Serviços para usar na agenda.
                    </p>
                  )}

                  <div className="rounded-lg border border-border bg-card shadow-card px-4 py-3 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-sm font-medium text-muted">
                        Total dos serviços
                      </span>
                      <div className="min-w-0 text-right">
                        {editingTotalAmount ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-base font-bold text-foreground">
                              R$
                            </span>
                            <input
                              aria-label="Valor do agendamento"
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              value={form.totalAmount}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  totalAmount: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveTotalAmount();
                                }
                              }}
                              className="w-[7.5rem] bg-transparent text-right text-base font-bold text-foreground outline-none placeholder:text-muted/50 focus:underline focus:decoration-success focus:underline-offset-4"
                            />
                          </div>
                        ) : (
                          <span className="text-base font-bold text-foreground">
                            {formatCurrency(displayTotalAmount)}
                          </span>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-2">
                          {editingTotalAmount ? (
                            <>
                              <button
                                type="button"
                                onClick={saveTotalAmount}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-card transition-all hover:bg-emerald-700"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={resetTotalAmountToServicesSum}
                                className="text-xs font-semibold text-muted transition-colors hover:text-foreground"
                              >
                                Usar soma
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={startEditingTotalAmount}
                              className="text-xs font-semibold text-foreground transition-colors hover:text-success"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-foreground">
                      Horário
                    </label>
                    {(form.startTime || form.endTime) && (
                      <span className="text-xs font-medium text-success">
                        {form.startTime || "--:--"} até {form.endTime || "--:--"}
                      </span>
                    )}
                  </div>
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border bg-card p-2.5 shadow-card sm:grid-cols-4">
                    {timeSlots.map((time) => {
                      const isSelectedEndpoint =
                        form.startTime === time || form.endTime === time;
                      const isInSelectedRange =
                        form.startTime &&
                        form.endTime &&
                        isTimeBetween(time, form.startTime, form.endTime);
                      const occupiedCount = slotOccupancyForFormDate.get(time) ?? 0;
                      const isFull = occupiedCount >= agendaCapacity;
                      const isConflictingEndTime =
                        !!form.startTime &&
                        !form.endTime &&
                        timeToMinutes(time) > timeToMinutes(form.startTime) &&
                        hasAppointmentConflict(
                          form.date,
                          form.isMultiDay ? form.endDate : form.date,
                          form.startTime,
                          time
                        );
                      const isUnavailable = isFull || isConflictingEndTime;
                      const showOccupancy = occupiedCount > 0 || isFull;

                      return (
                        <button
                          type="button"
                          key={time}
                          disabled={isUnavailable}
                          onClick={() => selectTimeSlot(time)}
                          className={`flex min-h-11 flex-col items-center justify-center rounded-full px-2 py-2 text-sm font-semibold leading-tight transition-all duration-200 sm:min-h-0 ${
                            isSelectedEndpoint
                              ? "bg-success text-white shadow-card"
                              : isInSelectedRange
                                ? "bg-success/20 text-success"
                              : isUnavailable
                                ? "cursor-not-allowed bg-muted/10 text-muted/50 line-through"
                                : "bg-background text-foreground hover:-translate-y-0.5 hover:bg-success/10 hover:text-success hover:shadow-card"
                          }`}
                        >
                          <span className={isFull ? "line-through" : ""}>{time}</span>
                          {showOccupancy && (
                            <span className="mt-0.5 text-[10px] font-bold opacity-80">
                              {isFull
                                ? `${agendaCapacity}/${agendaCapacity} lotado`
                                : `${occupiedCount}/${agendaCapacity} vagas`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted">
                    Clique no começo e depois no final. Expediente das{" "}
                    {BUSINESS_START_TIME} às {BUSINESS_END_TIME}.
                  </p>
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button
                  type="submit"
                  variant="success"
                  disabled={savingAppointment}
                  className="w-full bg-gradient-to-r from-success to-emerald-500 text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:from-success hover:to-emerald-600 hover:shadow-card-hover"
                >
                  <Check size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                  {savingAppointment
                    ? "Salvando..."
                    : editingAppointmentId
                      ? "Salvar alterações"
                      : "Salvar na agenda"}
                </Button>
              </form>
            )}

            <div className="space-y-3">
              {loadingAppointments ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Carregando horários...
                  </p>
                </div>
              ) : selectedAppointments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Nenhum horário neste dia
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Adicione um agendamento para organizar a rotina.
                  </p>
                </div>
              ) : (
                selectedAppointmentGroups.map((group) => {
                  const occupiedCount = group.appointments.length;
                  const isGroupFull = occupiedCount >= agendaCapacity;

                  return (
                    <div key={group.time} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted">
                          {group.time}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isGroupFull
                              ? "bg-danger/10 text-danger"
                              : "bg-success/10 text-success"
                          }`}
                        >
                          {occupiedCount}/{agendaCapacity} vagas ocupadas
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.appointments.map((appointment) => {
                          const style = getStatusStyle(appointment.status);

                          return (
                            <div
                              key={appointment.id}
                              className={`rounded-lg border border-l-4 p-4 shadow-card transition-shadow hover:shadow-card-hover ${
                                appointment.isMultiDay ? "border-dashed" : ""
                              } ${style.sideCard} ${style.sideAccent}`}
                            >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {appointment.client}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {appointment.service} • {appointment.vehicle}
                          </p>
                          {appointment.isMultiDay && (
                            <p className="mt-2 text-xs font-semibold text-primary">
                              {formatAppointmentDuration(appointment)}
                              {appointment.isContinuation ? " • continuação" : ""}
                            </p>
                          )}
                          {appointment.totalAmount > 0 && (
                            <p className="mt-2 text-xs font-semibold text-foreground">
                              Total: {formatCurrency(appointment.totalAmount)}
                            </p>
                          )}
                        </div>
                        <span
                          className={`w-fit rounded-lg px-2 py-1 text-xs font-semibold ${style.timeBadge}`}
                        >
                          {appointment.startTime} - {appointment.endTime}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleStatusMenu(appointment.id)}
                            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-shadow hover:shadow-card sm:min-h-0 sm:py-1 sm:text-xs ${style.statusBadge}`}
                            aria-haspopup="menu"
                            aria-expanded={openStatusMenuId === appointment.id}
                          >
                            <AppointmentStatusLabel
                              status={appointment.status}
                              iconSize={12}
                            />
                            <CaretDown
                              size={12}
                              weight={AGENDA_ICON_WEIGHT}
                              className={`transition-transform duration-200 ${
                                openStatusMenuId === appointment.id
                                  ? "rotate-180"
                                  : ""
                              }`}
                              aria-hidden
                            />
                          </button>

                          {(openStatusMenuId === appointment.id ||
                            closingStatusMenuId === appointment.id) && (
                            <div
                              className={`absolute bottom-full left-0 z-30 mb-2 w-40 rounded-lg border border-border bg-card shadow-card p-2 shadow-lg ${
                                closingStatusMenuId === appointment.id
                                  ? "status-menu-exit"
                                  : "status-menu-enter"
                              }`}
                            >
                              {appointmentStatuses.map((status) => {
                                const optionStyle = getStatusStyle(status);

                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() =>
                                      handleChangeStatus(appointment.id, status)
                                    }
                                    className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors last:mb-0 hover:bg-background sm:min-h-0 sm:text-xs ${optionStyle.statusBadge}`}
                                  >
                                    <AppointmentStatusLabel status={status} iconSize={12} />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                          <button
                            type="button"
                            onClick={() => openEditForm(appointment)}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white sm:min-h-0 sm:min-w-0"
                            title="Editar agendamento"
                            aria-label="Editar agendamento"
                          >
                            <PencilSimple size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAppointment(appointment)}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white sm:min-h-0 sm:min-w-0"
                            title="Excluir agendamento"
                            aria-label="Excluir agendamento"
                          >
                            <Trash size={16} weight={AGENDA_ICON_WEIGHT} aria-hidden />
                          </button>
                        </div>
                      </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSave={handleCreateClient}
      />
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .agenda-form-enter {
            animation: agenda-form-enter 220ms ease-out both;
          }

          .agenda-form-exit {
            animation: agenda-form-exit 180ms ease-in both;
          }

          .timeline-track-loading::after {
            animation: timeline-track-loading 900ms ease-out both;
          }

          .timeline-block-loading {
            animation: timeline-block-loading 620ms ease-out both;
            transform-origin: left center;
          }

          .status-menu-enter {
            animation: status-menu-enter 180ms ease-out both;
            transform-origin: bottom left;
          }

          .status-menu-exit {
            animation: status-menu-exit 160ms ease-in both;
            transform-origin: bottom left;
          }
        }

        .timeline-track-loading::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.45),
            transparent
          );
          transform: translateX(-100%);
        }

        .timeline-service-hover {
          transition:
            filter 180ms ease,
            box-shadow 180ms ease,
            transform 180ms ease;
          transform: perspective(700px) translateY(0) translateZ(0) rotateX(0);
          transform-origin: center bottom;
        }

        .timeline-service-hover:hover,
        .timeline-service-hover:focus-visible {
          z-index: 10;
          filter: brightness(1.12) saturate(1.18);
          transform: perspective(700px) translateY(-2px) translateZ(18px) rotateX(10deg);
          box-shadow:
            0 12px 24px rgba(15, 23, 42, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .calendar-appointment-pill {
          display: inline-block;
          max-width: 5.75rem;
          width: auto;
          border-radius: 4px;
          padding: 3px 7px;
          font-size: 9px;
          line-height: 12px;
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid transparent;
        }

        .calendar-pill-label {
          font-weight: 700;
        }

        .status-pill-confirmed {
          background: #dce8f5;
          color: #1a3a6b;
          border-color: #7aaee0;
        }

        .status-pill-pending {
          background: #fdf0d5;
          color: #8a5f0a;
          border-color: #f0c060;
        }

        .status-pill-cancelled {
          background: #fde8e8;
          color: #8a2020;
          border-color: #f0a0a0;
        }

        .status-pill-completed {
          background: #d1e8d1;
          color: #2d6a2d;
          border-color: #a8d5a8;
        }

        .calendar-multiday-pill {
          border-style: dashed;
          max-width: 100%;
          width: calc(100% + 0.5rem);
        }

        .calendar-multiday-start {
          border-top-right-radius: 0.25rem;
          border-bottom-right-radius: 0.25rem;
        }

        .calendar-multiday-middle {
          margin-left: -0.25rem;
          border-radius: 0.25rem;
        }

        .calendar-multiday-end {
          margin-left: -0.25rem;
          width: 100%;
          border-top-left-radius: 0.25rem;
          border-bottom-left-radius: 0.25rem;
        }

        .calendar-more-pill {
          max-width: 4.5rem;
          background: #e8e6e1;
          color: #5a5550;
          border-color: #c8c4be;
        }

        .status-confirmed-soft {
          background: rgba(37, 99, 235, 0.14);
          color: #2563eb;
        }

        .status-confirmed-solid {
          background: #2563eb;
        }

        .status-confirmed-card {
          border-color: rgba(37, 99, 235, 0.22);
          background: rgba(37, 99, 235, 0.07);
        }

        .status-confirmed-side-accent {
          border-left-color: #2563eb;
        }

        .status-completed-soft {
          background: rgba(5, 150, 105, 0.12);
          color: #047857;
        }

        .status-completed-solid {
          background: #059669;
        }

        .status-completed-card {
          border-color: rgba(5, 150, 105, 0.24);
          background: rgba(5, 150, 105, 0.08);
        }

        .status-completed-side-accent {
          border-left-color: #059669;
        }

        @keyframes agenda-form-enter {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes agenda-form-exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }
        }

        @keyframes timeline-track-loading {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes timeline-block-loading {
          from {
            opacity: 0.2;
            transform: scaleX(0);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes status-menu-enter {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes status-menu-exit {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
        }
      `}</style>
    </>
  );
}
