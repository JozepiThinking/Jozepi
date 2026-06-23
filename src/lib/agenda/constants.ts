import type { AppointmentStatus, AgendaPageTab } from "./types";

export const AGENDA_STORAGE_KEY = "auto-estetica-agenda-appointments";
export const BUSINESS_START_TIME = "07:00";
export const BUSINESS_END_TIME = "19:00";
export const SLOT_INTERVAL_MINUTES = 30;
export const DEFAULT_AGENDA_CAPACITY = 1;
export const AGENDA_CAPACITY_STORAGE_KEY = "auto-estetica-agenda-capacity";
export const AGENDA_ICON_WEIGHT = "light" as const;

export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const appointmentStatuses: AppointmentStatus[] = [
  "Pendente",
  "Confirmado",
  "Concluído",
  "Cancelado",
];

export const statusStyles: Record<
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

export const agendaPageTabs: { id: AgendaPageTab; label: string }[] = [
  { id: "calendar", label: "Agenda" },
  { id: "serviceList", label: "Lista de serviços" },
];

// Private helper used only to derive timeSlots at module load time.
// The exported timeToMinutes lives in utils.ts.
function _timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export const timeSlots = Array.from(
  {
    length:
      (_timeToMinutes(BUSINESS_END_TIME) - _timeToMinutes(BUSINESS_START_TIME)) /
      SLOT_INTERVAL_MINUTES,
  },
  (_, index) => {
    const totalMinutes =
      _timeToMinutes(BUSINESS_START_TIME) + index * SLOT_INTERVAL_MINUTES;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");

    return `${hours}:${minutes}`;
  }
);
