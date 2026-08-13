"use client";

import { useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface ChangePasswordFormProps {
  email: string;
}

type Step = "form" | "confirm";

function getFriendlyError(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [step, setStep] = useState<Step>("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const [checkingCurrent, setCheckingCurrent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  function resetAll() {
    setStep("form");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCode("");
    setError(null);
    setCodeError(null);
    setResendMessage(null);
  }

  async function sendConfirmationCode() {
    const supabase = createClient();
    const { error: reauthError } = await supabase.auth.reauthenticate();
    if (reauthError) {
      throw reauthError;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    setCheckingCurrent(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setError("Senha atual incorreta.");
        return;
      }

      await sendConfirmationCode();

      setStep("confirm");
    } catch (err) {
      setError(
        getFriendlyError(
          err,
          "Não foi possível enviar o código de confirmação. Tente novamente."
        )
      );
    } finally {
      setCheckingCurrent(false);
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeError(null);
    setResendMessage(null);

    if (!code.trim()) {
      setCodeError("Informe o código recebido por e-mail.");
      return;
    }

    setConfirming(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: code.trim(),
        current_password: currentPassword,
      });

      if (updateError) {
        setCodeError("Código inválido ou expirado. Solicite um novo código.");
        return;
      }

      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // Não bloqueia o fluxo se não for possível encerrar as outras sessões.
      }

      resetAll();
      setSuccess("Senha atualizada com sucesso.");
    } catch (err) {
      setCodeError(
        getFriendlyError(err, "Não foi possível confirmar a troca de senha.")
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setCodeError(null);
    setResendMessage(null);

    try {
      await sendConfirmationCode();
      setResendMessage("Enviamos um novo código para o seu e-mail.");
    } catch (err) {
      setCodeError(
        getFriendlyError(err, "Não foi possível reenviar o código.")
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-premium/10 text-premium">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Trocar senha
          </h3>
          <p className="mt-1 text-xs text-muted">
            {step === "form"
              ? "Confirme sua senha atual e defina uma nova senha."
              : "Confirme o código enviado para o seu e-mail para concluir a troca."}
          </p>
        </div>
      </div>

      {step === "form" ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Senha atual"
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setError(null);
              }}
              placeholder="Digite sua senha atual"
              autoComplete="current-password"
              className="bg-card"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Nova senha"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError(null);
                }}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                minLength={6}
                className="bg-card"
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError(null);
                }}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                minLength={6}
                className="bg-card"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-danger">{error}</p>
          )}
          {success && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              {success}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              variant="success"
              loading={checkingCurrent}
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              Trocar senha
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="mt-4">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-premium" />
            <span>
              Enviamos um código de confirmação para{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              Insira-o abaixo para concluir a troca de senha.
            </span>
          </div>

          <div className="mt-4">
            <Input
              label="Código de confirmação"
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError(null);
              }}
              placeholder="Digite o código recebido por e-mail"
              autoComplete="one-time-code"
              className="bg-card"
            />
          </div>

          {codeError && (
            <p className="mt-3 text-xs font-medium text-danger">
              {codeError}
            </p>
          )}
          {resendMessage && (
            <p className="mt-3 text-xs font-medium text-success">
              {resendMessage}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending ? "Reenviando..." : "Reenviar e-mail"}
              </button>
            </div>
            <Button
              type="submit"
              variant="success"
              loading={confirming}
              disabled={!code.trim()}
              className="w-full sm:w-auto"
            >
              Confirmar troca de senha
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
