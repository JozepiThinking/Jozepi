"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (recoveringPassword) {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess("Enviamos um link para redefinir sua senha no seu e-mail.");
      }

      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : authError.message
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      <Input
        label="E-mail"
        type="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {!recoveringPassword && (
        <Input
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          minLength={6}
        />
      )}

      <Button type="submit" className="w-full" loading={loading}>
        {recoveringPassword ? "Enviar link de recuperação" : "Entrar"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setRecoveringPassword((current) => !current);
          setError(null);
          setSuccess(null);
          setPassword("");
        }}
        className="w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary-hover"
      >
        {recoveringPassword ? "Voltar para login" : "Esqueci minha senha"}
      </button>

      <p className="text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-primary hover:text-primary-hover"
        >
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}
