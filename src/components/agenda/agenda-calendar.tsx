"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { syncVehicles } from "@/lib/clients/sync-vehicles";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import { type Client, type ClientFormData } from "@/types/client";

type AppointmentStatus = "Confirmado" | "Pendente" | "Cancelado" | "Concluído";

interface Appointment {
  id: string;
  date: string;
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

interface SelectOption {
  value: string;
  label: string;
  description?: string;
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
    calendarPill: "bg-success/10 text-success",
    timelineBlock: "bg-success",
    sideCard: "border-success/20 bg-success/5",
    sideAccent: "border-l-[var(--success)]",
    statusBadge: "bg-success/10 text-success",
    timeBadge: "bg-success/10 text-success",
  },
  Pendente: {
    calendarPill: "bg-warning/10 text-warning",
    timelineBlock: "bg-warning",
    sideCard: "border-warning/20 bg-warning/5",
    sideAccent: "border-l-[var(--warning)]",
    statusBadge: "bg-warning/10 text-warning",
    timeBadge: "bg-warning/10 text-warning",
  },
  Cancelado: {
    calendarPill: "bg-danger/10 text-danger",
    timelineBlock: "bg-danger",
    sideCard: "border-danger/20 bg-danger/5",
    sideAccent: "border-l-[var(--danger)]",
    statusBadge: "bg-danger/10 text-danger",
    timeBadge: "bg-danger/10 text-danger",
  },
  Concluído: {
    calendarPill: "bg-slate-200 text-slate-700",
    timelineBlock: "bg-slate-500",
    sideCard: "border-slate-300 bg-slate-100",
    sideAccent: "border-l-slate-500",
    statusBadge: "bg-slate-200 text-slate-700",
    timeBadge: "bg-slate-200 text-slate-700",
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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const AGENDA_STORAGE_KEY = "auto-estetica-agenda-appointments";
const BUSINESS_START_TIME = "07:00";
const BUSINESS_END_TIME = "19:00";
const SLOT_INTERVAL_MINUTES = 30;
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

function isAppointmentPast(appointment: Appointment, now: Date) {
  return new Date(`${appointment.date}T${appointment.endTime}:00`) <= now;
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
  onToggle: () => void;
  onSelect: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-left text-sm text-foreground shadow-sm transition-all duration-200 hover:border-success/40 hover:bg-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOption ? "font-medium" : "text-muted"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-xl">
          {selectedOption && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-danger/10 bg-danger/5 px-3 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {clearLabel}
              <X className="h-4 w-4" />
            </button>
          )}
          {options.length > 0 ? (
            <div role="listbox" aria-labelledby={id} className="space-y-1">
              {options.map((option) => {
                const selected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelect(option.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
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
            <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AgendaCalendar() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const [now, setNow] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
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
    startTime: "",
    endTime: "",
    clientId: "",
    vehicleId: "",
    serviceIds: [],
    totalAmount: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function loadAgendaData() {
    setLoadingClients(true);
    setLoadingServices(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (!profile?.workshop_id) {
      setLoadingClients(false);
      setLoadingServices(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

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

    setLoadingClients(false);
    setLoadingServices(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadAgendaData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const storedAppointments = window.localStorage.getItem(AGENDA_STORAGE_KEY);

      if (storedAppointments) {
        try {
          setAppointments(JSON.parse(storedAppointments) as Appointment[]);
        } catch {
          window.localStorage.removeItem(AGENDA_STORAGE_KEY);
        }
      }

      setAppointmentsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!appointmentsLoaded) return;

    window.localStorage.setItem(
      AGENDA_STORAGE_KEY,
      JSON.stringify(appointments)
    );
  }, [appointments, appointmentsLoaded]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextNow = new Date();
      setNow(nextNow);
      setAppointments((prev) => {
        let changed = false;
        const next = prev.map((appointment) => {
          if (
            appointment.status === "Confirmado" &&
            isAppointmentPast(appointment, nextNow)
          ) {
            changed = true;
            return { ...appointment, status: "Concluído" as const };
          }

          return appointment;
        });

        return changed ? next : prev;
      });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

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
    return normalizedAppointments.reduce<Record<string, Appointment[]>>(
      (acc, appointment) => {
        acc[appointment.date] = [...(acc[appointment.date] ?? []), appointment];
        return acc;
      },
      {}
    );
  }, [normalizedAppointments]);
  const selectedAppointments = (appointmentsByDate[selectedKey] ?? []).sort(
    (a, b) => a.startTime.localeCompare(b.startTime)
  );
  const currentDateKey = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const selectedDateIsToday = selectedKey === currentDateKey;
  const occupancyTitle = selectedDateIsToday ? "Ocupação hoje" : "Ocupação do dia";
  const timelineBlocks = [...selectedAppointments]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((appointment, index, dayAppointments) => {
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
        roundedClass,
        start: Math.max(0, Math.min(start, 100)),
        width: Math.max(0, Math.min(width, 100 - start)),
      };
    });
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
  const busyTimesForFormDate = useMemo(() => {
    const appointmentsForDate = appointments.filter(
      (appointment) =>
        appointment.date === form.date &&
        appointment.id !== editingAppointmentId
    );

    return new Set(
      timeSlots.filter((time) =>
        appointmentsForDate.some((appointment) =>
          isTimeBetween(time, appointment.startTime, appointment.endTime) ||
          time === appointment.startTime
        )
      )
    );
  }, [appointments, editingAppointmentId, form.date]);

  function resetForm() {
    setForm({
      date: selectedKey,
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

  function openEditForm(appointment: Appointment) {
    setOpenStatusMenuId(null);
    setForm({
      date: appointment.date,
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

  function hasAppointmentConflict(date: string, startTime: string, endTime: string) {
    return appointments.some(
      (appointment) =>
        appointment.date === date &&
        appointment.id !== editingAppointmentId &&
        rangesOverlap(
          startTime,
          endTime,
          appointment.startTime,
          appointment.endTime
        )
    );
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

    if (hasAppointmentConflict(form.date, form.startTime, time)) {
      setError("Esse intervalo cruza com outro agendamento.");
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

  function handleSaveAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !form.date ||
      !form.startTime ||
      !form.endTime ||
      !form.clientId ||
      !form.vehicleId ||
      form.serviceIds.length === 0
    ) {
      setError("Informe data, começo, final, cliente, veículo e serviço.");
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

    const hasConflict = appointments.some(
      (appointment) =>
        appointment.date === form.date &&
        appointment.id !== editingAppointmentId &&
        rangesOverlap(
          form.startTime,
          form.endTime,
          appointment.startTime,
          appointment.endTime
        )
    );

    if (hasConflict) {
      setError("Esse intervalo cruza com outro agendamento.");
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

    if (editingAppointmentId) {
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === editingAppointmentId
            ? {
                ...appointment,
                date: form.date,
                startTime: form.startTime,
                endTime: form.endTime,
                clientId: appointmentClient.id,
                vehicleId: appointmentVehicle.id,
                serviceIds: selectedServices.map((service) => service.id),
                client: appointmentClient.name,
                service: serviceLabel,
                totalAmount: appointmentTotal,
                vehicle: vehicleLabel,
              }
            : appointment
        )
      );
    } else {
      setAppointments((prev) => [
        ...prev,
        {
          id: `appointment-${Date.now()}`,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          clientId: appointmentClient.id,
          vehicleId: appointmentVehicle.id,
          serviceIds: selectedServices.map((service) => service.id),
          client: appointmentClient.name,
          service: serviceLabel,
          totalAmount: appointmentTotal,
          vehicle: vehicleLabel,
          status: "Pendente",
        },
      ]);
    }

    syncSelectedDate(form.date);
    closeForm();
  }

  function handleDeleteAppointment(appointment: Appointment) {
    setOpenStatusMenuId(null);
    const confirmed = window.confirm(
      `Deseja excluir o horário de ${appointment.client}?`
    );

    if (!confirmed) return;

    setAppointments((prev) =>
      prev.filter((item) => item.id !== appointment.id)
    );

    if (editingAppointmentId === appointment.id) {
      closeForm();
    }
  }

  function handleClearSelectedDay() {
    setOpenStatusMenuId(null);
    const confirmed = window.confirm(
      "Deseja excluir todos os horários deste dia?"
    );

    if (!confirmed) return;

    setAppointments((prev) =>
      prev.filter((appointment) => appointment.date !== selectedKey)
    );
    closeForm();
  }

  function handleChangeStatus(
    appointmentId: string,
    status: AppointmentStatus
  ) {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status }
          : appointment
      )
    );
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
        phone: data.phone.trim(),
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted">{occupancyTitle}</p>
              <div className="timeline-track-loading relative mt-4 h-7 overflow-hidden rounded-full bg-slate-200 shadow-inner">
                {timelineBlocks.map(({ appointment, roundedClass, start, width }, index) => {
                  const style = getStatusStyle(appointment.status);

                  return (
                    <button
                      type="button"
                      key={appointment.id}
                      onClick={() => setFocusedAppointmentId(appointment.id)}
                      title={`${appointment.startTime} - ${appointment.endTime} • ${appointment.client} • ${appointment.service}`}
                      aria-label={`Mostrar ${appointment.client} no próximo cliente`}
                      className={`timeline-block-loading timeline-service-hover absolute top-0 h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/80 ${roundedClass} ${style.timelineBlock}`}
                      style={{
                        left: `${start}%`,
                        width: `${width}%`,
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
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${style.timelineBlock}`}
                          />
                          {status}: {count}
                        </span>
                      );
                    })}
                </div>
              ) : null}
              <p className="mt-3 text-sm font-medium text-foreground">
                {selectedAppointments.length} agendamentos
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border-l-4 bg-card p-6 shadow-sm ${
            nextAppointmentStyle?.sideAccent ?? "border-l-border"
          }`}
        >
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted">Próximo cliente</p>
              {nextAppointment ? (
                <>
                  <p className="mt-2 text-3xl font-bold leading-tight text-foreground">
                    {nextAppointment.client}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                    <Car className="h-4 w-4 shrink-0" />
                    <span>{nextAppointment.vehicle}</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-lg font-semibold text-foreground">
                  Nenhum agendamento pendente
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              {nextAppointment && (
                <>
                  <span
                    className={`min-w-44 whitespace-nowrap rounded-2xl px-5 py-4 text-center text-xl font-bold leading-tight shadow-sm ${nextAppointmentStyle?.timeBadge}`}
                  >
                    {nextAppointment.startTime} - {nextAppointment.endTime}
                  </span>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${nextAppointmentStyle?.statusBadge}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {nextAppointment.status}
                    </span>

                    <div className="grid grid-cols-2 gap-1.5">
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
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${
                              isCurrentStatus
                                ? "cursor-default border-current opacity-60"
                                : "border-transparent hover:-translate-y-0.5 hover:shadow-sm"
                            } ${optionStyle.statusBadge}`}
                          >
                            {status}
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

      <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="self-start rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold capitalize text-foreground">
                {formatMonthTitle(currentMonth)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Clique em um dia para ver ou organizar os horários.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
                className="rounded-lg border border-border bg-background p-2 text-muted transition-colors hover:text-foreground"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMonth(startOfMonth(today));
                  setFocusedAppointmentId(null);
                  setSelectedDate(today);
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="rounded-lg border border-border bg-background p-2 text-muted transition-colors hover:text-foreground"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-background/60 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 p-4">
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
                  onClick={() => {
                    setFocusedAppointmentId(null);
                    setSelectedDate(day);
                  }}
                  style={index === 0 ? { gridColumnStart: day.getDay() + 1 } : undefined}
                  className={`flex min-h-24 flex-col items-stretch rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-transparent hover:border-border hover:bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? "bg-success text-white" : "text-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {dayAppointments.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {visibleAppointments.map((appointment) => {
                        const style = getStatusStyle(appointment.status);

                        return (
                          <span
                            key={appointment.id}
                            className={`block truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-3 ${style.calendarPill}`}
                            title={`${appointment.startTime} - ${appointment.endTime} • ${appointment.client}`}
                          >
                            {appointment.startTime} {getShortClientName(appointment.client)}
                          </span>
                        );
                      })}

                      {hiddenAppointmentsCount > 0 && (
                        <span className="block truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold leading-3 text-slate-500">
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

        <aside className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Dia selecionado
            </p>
            <h2 className="mt-1 text-lg font-semibold capitalize text-foreground">
              {formatLongDate(selectedDate)}
            </h2>
          </div>

          <div className="space-y-4 p-6">
            <Button
              variant="success"
              className="w-full"
              onClick={openCreateForm}
            >
              <Plus className="h-4 w-4" />
              Novo agendamento
            </Button>

            {selectedAppointments.length > 0 && (
              <button
                type="button"
                onClick={handleClearSelectedDay}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Limpar dia
              </button>
            )}

            {creating && (
              <form
                onSubmit={handleSaveAppointment}
                className={`space-y-4 rounded-xl border border-border bg-background p-4 ${
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
                    className="rounded-lg p-1 text-muted transition-colors hover:bg-card hover:text-foreground"
                    aria-label="Fechar formulário"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  label="Data"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                />
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
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-card p-2.5 shadow-sm sm:grid-cols-4">
                    {timeSlots.map((time) => {
                      const isSelectedEndpoint =
                        form.startTime === time || form.endTime === time;
                      const isInSelectedRange =
                        form.startTime &&
                        form.endTime &&
                        isTimeBetween(time, form.startTime, form.endTime);
                      const isBusy = busyTimesForFormDate.has(time);
                      const isConflictingEndTime =
                        !!form.startTime &&
                        !form.endTime &&
                        timeToMinutes(time) > timeToMinutes(form.startTime) &&
                        hasAppointmentConflict(form.date, form.startTime, time);
                      const isUnavailable = isBusy || isConflictingEndTime;

                      return (
                        <button
                          type="button"
                          key={time}
                          disabled={isUnavailable}
                          onClick={() => selectTimeSlot(time)}
                          className={`rounded-full px-2 py-2 text-sm font-semibold transition-all duration-200 ${
                            isSelectedEndpoint
                              ? "bg-success text-white shadow-sm"
                              : isInSelectedRange
                                ? "bg-success/20 text-success"
                              : isUnavailable
                                ? "cursor-not-allowed bg-muted/10 text-muted/50 line-through"
                                : "bg-background text-foreground hover:-translate-y-0.5 hover:bg-success/10 hover:text-success hover:shadow-sm"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted">
                    Clique no começo e depois no final. Expediente das{" "}
                    {BUSINESS_START_TIME} às {BUSINESS_END_TIME}.
                  </p>
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
                      className="text-xs font-semibold text-success transition-colors hover:text-success/80"
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-all duration-200 hover:bg-success hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar serviço
                    </button>
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedServices.map((service) => (
                        <span
                          key={service.id}
                          className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success shadow-sm"
                        >
                          {service.name}
                          <button
                            type="button"
                            onClick={() => removeServiceFromForm(service.id)}
                            className="rounded-full p-0.5 transition-colors hover:bg-success/20"
                            aria-label={`Remover ${service.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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

                  <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted">
                        Total dos serviços
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-foreground">
                          {formatCurrency(displayTotalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTotalAmount((current) => !current);
                            setForm((prev) =>
                              prev.totalAmount
                                ? prev
                                : { ...prev, totalAmount: String(servicesTotal) }
                            );
                          }}
                          className="text-xs font-semibold text-success transition-colors hover:text-success/80"
                        >
                          {editingTotalAmount ? "Fechar" : "Editar"}
                        </button>
                      </div>
                    </div>

                    {editingTotalAmount && (
                      <div className="flex items-center gap-2">
                        <Input
                          label="Valor do agendamento"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.totalAmount}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              totalAmount: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, totalAmount: "" }));
                            setEditingTotalAmount(false);
                          }}
                          className="mt-6 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
                        >
                          Usar soma
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button
                  type="submit"
                  variant="success"
                  className="w-full bg-gradient-to-r from-success to-emerald-500 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:from-success hover:to-emerald-600 hover:shadow-md"
                >
                  <Check className="h-4 w-4" />
                  {editingAppointmentId ? "Salvar alterações" : "Salvar na agenda"}
                </Button>
              </form>
            )}

            <div className="space-y-3">
              {selectedAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Nenhum horário neste dia
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Adicione um agendamento para organizar a rotina.
                  </p>
                </div>
              ) : (
                selectedAppointments.map((appointment) => {
                  const style = getStatusStyle(appointment.status);

                  return (
                    <div
                      key={appointment.id}
                      className={`rounded-xl border border-l-4 p-4 shadow-sm transition-shadow hover:shadow-md ${style.sideCard} ${style.sideAccent}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {appointment.client}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {appointment.service} • {appointment.vehicle}
                          </p>
                          {appointment.totalAmount > 0 && (
                            <p className="mt-2 text-xs font-semibold text-foreground">
                              Total: {formatCurrency(appointment.totalAmount)}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${style.timeBadge}`}
                        >
                          {appointment.startTime} - {appointment.endTime}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleStatusMenu(appointment.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-shadow hover:shadow-sm ${style.statusBadge}`}
                            aria-haspopup="menu"
                            aria-expanded={openStatusMenuId === appointment.id}
                          >
                            {appointment.status}
                            <ChevronDown
                              className={`h-3 w-3 transition-transform duration-200 ${
                                openStatusMenuId === appointment.id
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>

                          {(openStatusMenuId === appointment.id ||
                            closingStatusMenuId === appointment.id) && (
                            <div
                              className={`absolute bottom-full left-0 z-30 mb-2 w-40 rounded-xl border border-border bg-card p-2 shadow-lg ${
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
                                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors last:mb-0 hover:bg-background ${optionStyle.statusBadge}`}
                                  >
                                    {status}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(appointment)}
                            className="rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white"
                            title="Editar agendamento"
                            aria-label="Editar agendamento"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAppointment(appointment)}
                            className="rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white"
                            title="Excluir agendamento"
                            aria-label="Excluir agendamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
            top 180ms ease,
            height 180ms ease,
            transform 180ms ease;
          transform: perspective(700px) translateY(0) translateZ(0) rotateX(0);
          transform-origin: center bottom;
        }

        .timeline-service-hover:hover,
        .timeline-service-hover:focus-visible {
          top: -4px;
          z-index: 10;
          height: calc(100% + 6px);
          filter: brightness(1.12) saturate(1.18);
          transform: perspective(700px) translateY(-2px) translateZ(18px) rotateX(10deg);
          box-shadow:
            0 12px 24px rgba(15, 23, 42, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
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
