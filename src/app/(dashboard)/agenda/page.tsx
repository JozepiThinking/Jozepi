import { Header } from "@/components/layout/header";
import { CalendarDays, Clock, Plus, UserRound } from "lucide-react";

const todayAppointments = [
  {
    time: "09:00",
    client: "Cliente exemplo",
    service: "Lavagem completa",
    vehicle: "Toyota Corolla",
    status: "Confirmado",
  },
  {
    time: "14:30",
    client: "Cliente exemplo 2",
    service: "Polimento",
    vehicle: "Honda Civic",
    status: "Pendente",
  },
];

export default function AgendaPage() {
  return (
    <>
      <Header
        title="Agenda"
        description="Organize os atendimentos e horários da estética automotiva"
        actions={
          <button className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-success/90">
            <Plus className="h-4 w-4" />
            Novo agendamento
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Agendamentos hoje</p>
              <p className="mt-2 text-3xl font-bold text-foreground">2</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Próximo horário</p>
              <p className="mt-2 text-3xl font-bold text-foreground">09:00</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Clientes do dia</p>
              <p className="mt-2 text-3xl font-bold text-foreground">2</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
              <UserRound className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Agenda de hoje
          </h2>
          <p className="mt-1 text-sm text-muted">
            Lista inicial para acompanhar horários e atendimentos.
          </p>
        </div>

        <div className="divide-y divide-border">
          {todayAppointments.map((appointment) => (
            <div
              key={`${appointment.time}-${appointment.client}`}
              className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-background px-3 py-2 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {appointment.time}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {appointment.client}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {appointment.service} • {appointment.vehicle}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {appointment.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
