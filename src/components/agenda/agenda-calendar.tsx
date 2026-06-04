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
}

interface AgendaService {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number | null;
  active: boolean;
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

function getServicePrice(service: AgendaService) {
  return Number(service.price) || 0;
}

function buildCalendarDays(currentMonth: Date) {
  const firstDay = startOfMonth(currentMonth);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
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
  const [addingService, setAddingService] = useState(false);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
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
  const todayAppointments = appointmentsByDate[dateKey(today)] ?? [];
  const currentDateKey = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const occupiedSlotsToday = new Set(
    todayAppointments.flatMap((appointment) =>
      timeSlots.filter(
        (time) =>
          timeToMinutes(time) >= timeToMinutes(appointment.startTime) &&
          timeToMinutes(time) < timeToMinutes(appointment.endTime)
      )
    )
  ).size;
  const totalSlots = timeSlots.length;
  const timelineBlocks = [...todayAppointments]
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
  const todayStatusCounts = appointmentStatuses.map((status) => ({
    status,
    count: todayAppointments.filter((appointment) => appointment.status === status)
      .length,
  }));
  const nextAppointment =
    selectedAppointments
      .filter(
        (appointment) =>
          (appointment.status === "Pendente" ||
            appointment.status === "Confirmado") &&
          (selectedKey !== currentDateKey ||
            timeToMinutes(appointment.endTime) > timeToMinutes(currentTime))
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  const nextAppointmentStyle = nextAppointment
    ? getStatusStyle(nextAppointment.status)
    : null;
  const nextAppointmentServices = nextAppointment?.service
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean) ?? [];
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectedClientVehicles = selectedClient?.vehicles ?? [];
  const selectedServices = services.filter((service) =>
    form.serviceIds.includes(service.id)
  );
  const availableServices = services.filter(
    (service) => !form.serviceIds.includes(service.id)
  );
  const servicesTotal = selectedServices.reduce(
    (total, service) => total + getServicePrice(service),
    0
  );
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
    });
    setError(null);
    setAddingService(false);
  }

  function openCreateForm() {
    resetForm();
    setEditingAppointmentId(null);
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
    });
    setEditingAppointmentId(appointment.id);
    setError(null);
    setCreating(true);
    setAddingService(false);
  }

  function addServiceToForm(serviceId: string) {
    if (!serviceId) return;

    setForm((prev) =>
      prev.serviceIds.includes(serviceId)
        ? prev
        : { ...prev, serviceIds: [...prev.serviceIds, serviceId] }
    );
    setAddingService(false);
  }

  function removeServiceFromForm(serviceId: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.filter((id) => id !== serviceId),
    }));
  }

  function selectTimeSlot(time: string) {
    setError(null);
    setForm((prev) => {
      if (
        !prev.startTime ||
        prev.endTime ||
        timeToMinutes(time) <= timeToMinutes(prev.startTime)
      ) {
        return { ...prev, startTime: time, endTime: "" };
      }

      return { ...prev, endTime: time };
    });
  }

  function closeForm() {
    resetForm();
    setEditingAppointmentId(null);
    setCreating(false);
  }

  function syncSelectedDate(date: string) {
    const nextDate = new Date(`${date}T00:00:00`);
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
                totalAmount: servicesTotal,
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
          totalAmount: servicesTotal,
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
    setOpenStatusMenuId(null);
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
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted">Ocupação hoje</p>
              <div className="relative mt-4 h-7 overflow-hidden rounded-full bg-slate-200 shadow-inner">
                {timelineBlocks.map(({ appointment, roundedClass, start, width }) => {
                  const style = getStatusStyle(appointment.status);

                  return (
                    <div
                      key={appointment.id}
                      title={`${appointment.startTime} - ${appointment.endTime} • ${appointment.client} • ${appointment.service}`}
                      className={`absolute top-0 h-full ${roundedClass} ${style.timelineBlock}`}
                      style={{
                        left: `${start}%`,
                        width: `${width}%`,
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
              {todayAppointments.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {todayStatusCounts
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
                {todayAppointments.length} agendamentos
              </p>
              <p className="mt-1 text-xs text-muted">
                {occupiedSlotsToday} de {totalSlots} horários ocupados
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
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${nextAppointmentStyle?.statusBadge}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {nextAppointment.status}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-border bg-card shadow-sm">
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

          <div className="grid grid-cols-7 p-4">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayAppointments = appointmentsByDate[key] ?? [];
              const isCurrentMonth =
                day.getMonth() === currentMonth.getMonth();
              const isSelected = key === selectedKey;
              const isToday = key === dateKey(today);

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-24 rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-transparent hover:border-border hover:bg-background"
                  } ${isCurrentMonth ? "text-foreground" : "text-muted/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-success text-white" : ""
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {dayAppointments.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayAppointments.slice(0, 2).map((appointment) => {
                      const style = getStatusStyle(appointment.status);

                      return (
                        <div
                          key={appointment.id}
                          className={`truncate rounded-md px-2 py-1 text-[11px] font-medium ${style.calendarPill}`}
                        >
                          {appointment.startTime} - {appointment.endTime}{" "}
                          {appointment.client}
                        </div>
                      );
                    })}
                    {dayAppointments.length > 2 && (
                      <p className="px-1 text-[11px] text-muted">
                        +{dayAppointments.length - 2} horários
                      </p>
                    )}
                  </div>
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
                className="space-y-4 rounded-xl border border-border bg-background p-4"
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

                      return (
                        <button
                          type="button"
                          key={time}
                          disabled={isBusy}
                          onClick={() => selectTimeSlot(time)}
                          className={`rounded-full px-2 py-2 text-sm font-semibold transition-all duration-200 ${
                            isSelectedEndpoint
                              ? "bg-success text-white shadow-sm"
                              : isInSelectedRange
                                ? "bg-success/20 text-success"
                              : isBusy
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
                      onClick={() => setClientModalOpen(true)}
                      className="text-xs font-semibold text-success transition-colors hover:text-success/80"
                    >
                      Novo cliente
                    </button>
                  </div>
                  <select
                    id="agenda-client"
                    value={form.clientId}
                    disabled={loadingClients}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        clientId: event.target.value,
                        vehicleId: "",
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-foreground shadow-sm transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {loadingClients
                        ? "Carregando clientes..."
                        : "Selecione um cliente"}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
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
                  <select
                    id="agenda-vehicle"
                    value={form.vehicleId}
                    disabled={
                      !form.clientId || selectedClientVehicles.length === 0
                    }
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleId: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-foreground shadow-sm transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {!form.clientId
                        ? "Selecione um cliente primeiro"
                        : selectedClientVehicles.length === 0
                          ? "Cliente sem veículo cadastrado"
                          : "Selecione um veículo"}
                    </option>
                    {selectedClientVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model} - {vehicle.plate}
                      </option>
                    ))}
                  </select>
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
                      onClick={() => setAddingService(true)}
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

                  {selectedServices.length > 0 ? (
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
                  ) : (
                    <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-center text-xs text-muted">
                      Nenhum serviço adicionado.
                    </p>
                  )}

                  {addingService && (
                    <select
                      autoFocus
                      defaultValue=""
                      disabled={loadingServices || availableServices.length === 0}
                      onChange={(event) => addServiceToForm(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-foreground shadow-sm transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        {loadingServices
                          ? "Carregando serviços..."
                          : availableServices.length === 0
                            ? "Todos os serviços já adicionados"
                            : "Selecione um serviço"}
                      </option>
                      {availableServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                          {service.duration_minutes
                            ? ` - ${service.duration_minutes} min`
                            : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  {!loadingServices && services.length === 0 && (
                    <p className="text-xs text-muted">
                      Cadastre serviços na aba Serviços para usar na agenda.
                    </p>
                  )}

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                    <span className="text-sm font-medium text-muted">
                      Total dos serviços
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {formatCurrency(servicesTotal)}
                    </span>
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
                            onClick={() =>
                              setOpenStatusMenuId((current) =>
                                current === appointment.id
                                  ? null
                                  : appointment.id
                              )
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-shadow hover:shadow-sm ${style.statusBadge}`}
                            aria-haspopup="menu"
                            aria-expanded={openStatusMenuId === appointment.id}
                          >
                            {appointment.status}
                            <ChevronDown className="h-3 w-3" />
                          </button>

                          {openStatusMenuId === appointment.id && (
                            <div className="absolute bottom-full left-0 z-30 mb-2 w-40 rounded-xl border border-border bg-card p-2 shadow-lg">
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
                                    {appointment.status === status && (
                                      <span className="text-[10px]">Atual</span>
                                    )}
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
    </>
  );
}
