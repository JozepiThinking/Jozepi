import { AgendaCalendar } from "@/components/agenda/agenda-calendar";
import { Header } from "@/components/layout/header";

export default function AgendaPage() {
  return (
    <>
      <Header
        title="Agenda"
        description="Organize os atendimentos em um calendário mensal"
      />

      <AgendaCalendar />
    </>
  );
}
