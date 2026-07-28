"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface AccountCredentialsCardProps {
  email: string;
}

export function AccountCredentialsCard({ email }: AccountCredentialsCardProps) {
  const [showMasked, setShowMasked] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Senha atualizada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar a senha.");
    } finally {
      setSaving(false);
    }
  }

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
            <button
              type="button"
              onClick={() => setShowMasked((v) => !v)}
              className="rounded p-1 text-muted transition-colors hover:bg-card hover:text-foreground"
              aria-label={showMasked ? "Ocultar senha" : "Mostrar máscara"}
              title="A senha real não pode ser recuperada — só a máscara"
            >
              {showMasked ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p className="font-mono text-sm font-semibold tracking-widest text-foreground">
            {showMasked ? "••••••••••••" : "••••••••"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Protegida — use o formulário abaixo para alterar
          </p>
        </div>
      </div>

      <form
        onSubmit={handleChangePassword}
        className="mt-5 rounded-lg border border-border bg-background p-4 sm:p-5"
      >
        <h3 className="text-sm font-semibold text-foreground">Alterar senha</h3>
        <p className="mt-1 text-xs text-muted">
          Defina uma nova senha para esta conta.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            minLength={6}
            className="bg-card"
          />
          <Input
            label="Confirmar senha"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            minLength={6}
            className="bg-card"
          />
        </div>

        {error && (
          <p className="mt-3 text-xs font-medium text-danger">{error}</p>
        )}
        {success && (
          <p className="mt-3 text-xs font-medium text-success">{success}</p>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            variant="success"
            loading={saving}
            disabled={!newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            Salvar nova senha
          </Button>
        </div>
      </form>
    </div>
  );
}
