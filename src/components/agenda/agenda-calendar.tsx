"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
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
import { type Client, type ClientFormData } from "@/types/client";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  clientId: string;
  vehicleId: string;
  serviceId: string;
  client: string;
  service: string;
  vehicle: string;
  status: "Confirmado" | "Pendente";
}

interface AppointmentForm {
  date: string;
  startTime: string;
  endTime: string;
  clientId: string;
  vehicleId: string;
  serviceId: string;
}

interface AgendaService {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number | null;
  active: boolean;
}

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const timeSlots = Array.from({ length: 27 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
});

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

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

function createInitialAppointments(today: Date): Appointment[] {
  const secondDate = new Date(today);
  secondDate.setDate(today.getDate() + 2);

  const fourthDate = new Date(today);
  fourthDate.setDate(today.getDate() + 4);

  return [
    {
      id: "appointment-1",
      date: dateKey(today),
      startTime: "09:00",
      endTime: "10:00",
      clientId: "",
      vehicleId: "",
      serviceId: "",
      client: "Cliente exemplo",
      service: "Lavagem completa",
      vehicle: "Toyota Corolla",
      status: "Confirmado",
    },
    {
      id: "appointment-2",
      date: dateKey(today),
      startTime: "14:30",
      endTime: "16:00",
      clientId: "",
      vehicleId: "",
      serviceId: "",
      client: "Cliente exemplo 2",
      service: "Polimento",
      vehicle: "Honda Civic",
      status: "Pendente",
    },
    {
      id: "appointment-3",
      date: dateKey(secondDate),
      startTime: "10:00",
      endTime: "11:30",
      clientId: "",
      vehicleId: "",
      serviceId: "",
      client: "Cliente exemplo 3",
      service: "Higienização interna",
      vehicle: "Jeep Compass",
      status: "Confirmado",
    },
    {
      id: "appointment-4",
      date: dateKey(fourthDate),
      startTime: "16:00",
      endTime: "18:00",
      clientId: "",
      vehicleId: "",
      serviceId: "",
      client: "Cliente exemplo 4",
      service: "Cristalização",
      vehicle: "Volkswagen Nivus",
      status: "Pendente",
    },
  ];
}

export function AgendaCalendar() {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState(() =>
    createInitialAppointments(today)
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState<AppointmentForm>({
    date: dateKey(today),
    startTime: "",
    endTime: "",
    clientId: "",
    vehicleId: "",
    serviceId: "",
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

  const selectedKey = dateKey(selectedDate);
  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth]
  );
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, Appointment[]>>(
      (acc, appointment) => {
        acc[appointment.date] = [...(acc[appointment.date] ?? []), appointment];
        return acc;
      },
      {}
    );
  }, [appointments]);
  const selectedAppointments = (appointmentsByDate[selectedKey] ?? []).sort(
    (a, b) => a.startTime.localeCompare(b.startTime)
  );
  const todayAppointments = appointmentsByDate[dateKey(today)] ?? [];
  const nextAppointment = selectedAppointments[0];
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectedClientVehicles = selectedClient?.vehicles ?? [];
  const selectedService = services.find((service) => service.id === form.serviceId);
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
      serviceId: "",
    });
    setError(null);
  }

  function openCreateForm() {
    resetForm();
    setEditingAppointmentId(null);
    setCreating(true);
  }

  function openEditForm(appointment: Appointment) {
    setForm({
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      clientId: appointment.clientId,
      vehicleId: appointment.vehicleId,
      serviceId: appointment.serviceId,
    });
    setEditingAppointmentId(appointment.id);
    setError(null);
    setCreating(true);
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
      !form.serviceId
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

    if (!appointmentClient || !appointmentVehicle || !selectedService) {
      setError("Selecione cliente, veículo e serviço válidos.");
      return;
    }

    const vehicleLabel = `${appointmentVehicle.brand} ${appointmentVehicle.model} - ${appointmentVehicle.plate}`;

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
                serviceId: selectedService.id,
                client: appointmentClient.name,
                service: selectedService.name,
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
          serviceId: selectedService.id,
          client: appointmentClient.name,
          service: selectedService.name,
          vehicle: vehicleLabel,
          status: "Pendente",
        },
      ]);
    }

    syncSelectedDate(form.date);
    closeForm();
  }

  function handleDeleteAppointment(appointment: Appointment) {
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
    const confirmed = window.confirm(
      "Deseja excluir todos os horários deste dia?"
    );

    if (!confirmed) return;

    setAppointments((prev) =>
      prev.filter((appointment) => appointment.date !== selectedKey)
    );
    closeForm();
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">
                Agendamentos hoje
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {todayAppointments.length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">
                Próximo horário
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {nextAppointment
                  ? `${nextAppointment.startTime} - ${nextAppointment.endTime}`
                  : "--:--"}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Clock className="h-6 w-6" />
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
                    {dayAppointments.slice(0, 2).map((appointment) => (
                      <div
                        key={appointment.id}
                        className="truncate rounded-md bg-success/10 px-2 py-1 text-[11px] font-medium text-success"
                      >
                        {appointment.startTime} - {appointment.endTime}{" "}
                        {appointment.client}
                      </div>
                    ))}
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
                <div className="space-y-1.5">
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
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border bg-card p-2 sm:grid-cols-4">
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
                          className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                            isSelectedEndpoint
                              ? "bg-success text-white"
                              : isInSelectedRange
                                ? "bg-success/20 text-success"
                              : isBusy
                                ? "cursor-not-allowed bg-muted/10 text-muted/50 line-through"
                                : "bg-background text-foreground hover:bg-success/10 hover:text-success"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted">
                    Clique no começo e depois no final. Horários riscados já
                    estão ocupados nesta data.
                  </p>
                </div>
                <div className="space-y-1.5">
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
                    className="w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="space-y-1.5">
                  <label
                    htmlFor="agenda-vehicle"
                    className="block text-sm font-semibold text-foreground"
                  >
                    Veículo
                  </label>
                  <select
                    id="agenda-vehicle"
                    value={form.vehicleId}
                    disabled={!form.clientId || selectedClientVehicles.length === 0}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleId: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="space-y-1.5">
                  <label
                    htmlFor="agenda-service"
                    className="block text-sm font-semibold text-foreground"
                  >
                    Serviço
                  </label>
                  <select
                    id="agenda-service"
                    value={form.serviceId}
                    disabled={loadingServices || services.length === 0}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        serviceId: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {loadingServices
                        ? "Carregando serviços..."
                        : services.length === 0
                          ? "Nenhum serviço cadastrado"
                          : "Selecione um serviço"}
                    </option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                        {service.duration_minutes
                          ? ` - ${service.duration_minutes} min`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {!loadingServices && services.length === 0 && (
                    <p className="text-xs text-muted">
                      Cadastre serviços na aba Serviços para usar na agenda.
                    </p>
                  )}
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <Button type="submit" variant="success" className="w-full">
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
                selectedAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {appointment.client}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {appointment.service} • {appointment.vehicle}
                        </p>
                      </div>
                      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {appointment.startTime} - {appointment.endTime}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                        {appointment.status}
                      </span>
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
                ))
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
