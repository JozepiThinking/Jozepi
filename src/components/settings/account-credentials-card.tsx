import { KeyRound, Lock, Mail } from "lucide-react";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { SettingsCollapsibleCard } from "@/components/settings/settings-collapsible-card";

interface AccountCredentialsCardProps {
  email: string;
}

export function AccountCredentialsCard({ email }: AccountCredentialsCardProps) {
  return (
    <SettingsCollapsibleCard
      icon={<KeyRound className="h-5 w-5" />}
      title="Conta e acesso"
      description="E-mail e senha da conta logada. A senha fica criptografada e não pode ser exibida em texto puro."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Mail className="h-3 w-3" />
            E-mail cadastrado
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {email || "Não informado"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Senha cadastrada
            </p>
            <span className="text-muted" title="A senha real nunca pode ser exibida">
              <Lock className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="font-mono text-sm font-semibold tracking-widest text-foreground">
            ••••••••
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Protegida — a senha real não pode ser exibida
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ChangePasswordForm email={email} />
      </div>
    </SettingsCollapsibleCard>
  );
}
