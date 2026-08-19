"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SignupFormProps {
  mode: "invite" | "bootstrap";
  inviteToken?: string;
  workshopName?: string;
  lockedEmail?: string | null;
}

export function SignupForm({
  mode,
  inviteToken,
  workshopName,
  lockedEmail,
}: SignupFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [newWorkshopName, setNewWorkshopName] = useState("");
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data:
          mode === "invite"
            ? {
                full_name: fullName,
                invite_token: inviteToken,
              }
            : {
                full_name: fullName,
                workshop_name: newWorkshopName,
              },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      const message = authError.message.toLowerCase();
      if (message.includes("database error") || message.includes("convite")) {
        setError(
          "Este convite não é mais válido. Peça um novo link para a oficina."
        );
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mode === "invite" && workshopName && (
        <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground">
          Convite para entrar na oficina{" "}
          <span className="font-semibold">{workshopName}</span>.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        label="Seu nome"
        type="text"
        placeholder="João Silva"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        autoComplete="name"
      />

      {mode === "bootstrap" && (
        <Input
          label="Nome da oficina"
          type="text"
          placeholder="Estética Automotiva Premium"
          value={newWorkshopName}
          onChange={(e) => setNewWorkshopName(e.target.value)}
          required
        />
      )}

      <Input
        label="E-mail"
        type="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={Boolean(lockedEmail)}
      />

      <Input
        label="Senha"
        type="password"
        placeholder="Mínimo 6 caracteres"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={6}
      />

      <Button type="submit" className="w-full" loading={loading}>
        Criar conta
      </Button>

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary-hover"
        >
          Fazer login
        </Link>
      </p>
    </form>
  );
}
