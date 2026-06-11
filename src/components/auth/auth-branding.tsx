import { CheckCircle2 } from "lucide-react";

const features = [
  "Gestão completa de clientes e veículos",
  "Ordens de serviço com cálculo automático",
  "Controle financeiro integrado",
  "Dashboard em tempo real",
];

export function AuthBranding() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 lg:flex lg:w-1/2">
      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar-active to-sidebar opacity-90" />
      <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 font-brand">
        <div className="inline-flex flex-col">
          <span className="block text-[2.15rem] font-bold uppercase leading-none tracking-[0.16em] text-white">
            Jozep&apos;s Garage
          </span>
          <span className="mt-3 block text-[0.7rem] font-semibold uppercase tracking-[0.58em] text-white/45">
            ESTÉTICA AUTOMOTIVA
          </span>
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        <h1 className="text-4xl font-bold leading-tight text-white">
          Gerencie sua estética automotiva com profissionalismo
        </h1>
        <p className="text-lg text-white/70">
          Sistema completo para oficinas de detailing, lavagem e estética
          veicular.
        </p>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-white/80">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-sm text-white/40">
        © 2026 Jozep&apos;s Garage
      </p>
    </div>
  );
}
