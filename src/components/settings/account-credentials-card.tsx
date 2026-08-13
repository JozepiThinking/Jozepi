import { KeyRound, Lock, Mail } from "lucide-react";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

interface AccountCredentialsCardProps {
  email: string;
}

export function AccountCredentialsCard({ email }: AccountCredentialsCardProps) {
  return (
    <div className="card-surface">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-premium/10 text-premium">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            Conta e acesso
          </h2>
          <p className="mt-1 text-sm text-muted">
            E-mail e senha da conta logada. A senha fica criptografada e não pode
            ser exibida em texto puro.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <span
              className="text-muted"
              title="A senha real nunca pode ser exibida"
            >
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
    </div>
  );
}
