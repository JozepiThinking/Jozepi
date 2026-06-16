import { Header } from "@/components/layout/header";
import { AgendaCapacityCard } from "@/components/settings/agenda-capacity-card";
import { Bell, LockKeyhole, Settings, SlidersHorizontal } from "lucide-react";

const settingsSections = [
  {
    title: "Preferências",
    description: "Ajustes gerais da experiência no sistema.",
    icon: SlidersHorizontal,
  },
  {
    title: "Notificações",
    description: "Configure avisos e lembretes da operação.",
    icon: Bell,
  },
  {
    title: "Segurança",
    description: "Opções de acesso e proteção da conta.",
    icon: LockKeyhole,
  },
];

export default function ConfiguracoesPage() {
  return (
    <>
      <Header
        title="Configurações"
        description="Gerencie preferências, notificações e segurança"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {settingsSections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-success/10 text-success">
              <section.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{section.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Ajustes do sistema
            </h2>
            <p className="mt-1 text-sm text-muted">
              Esta área está pronta para receber as próximas configurações do
              painel.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AgendaCapacityCard />
      </div>
    </>
  );
}
