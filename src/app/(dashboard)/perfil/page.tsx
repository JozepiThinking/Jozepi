import { Header } from "@/components/layout/header";
import { UserProfileCard } from "@/components/profile/user-profile-card";
import { createClient } from "@/lib/supabase/server";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, workshop_id")
    .eq("id", user.id)
    .single();

  let companyName: string | null = null;

  if (profile?.workshop_id) {
    const { data: workshop } = await supabase
      .from("workshops")
      .select("name")
      .eq("id", profile.workshop_id)
      .single();

    companyName = workshop?.name ?? null;
  }

  return (
    <>
      <Header
        title="Meu Perfil"
        description="Dados do usuário conectado ao sistema"
      />

      <UserProfileCard
        userId={user.id}
        email={user.email ?? ""}
        fullName={profile?.full_name}
        role={profile?.role}
        companyName={companyName}
        avatarUrl={
          typeof user.user_metadata.avatar_url === "string"
            ? user.user_metadata.avatar_url
            : null
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <UserRound className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Perfil do usuário
          </p>
          <p className="mt-1 text-xs text-muted">
            Informações pessoais da conta.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Mail className="h-5 w-5 text-info" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Acesso por e-mail
          </p>
          <p className="mt-1 text-xs text-muted">
            Usado para login e notificações.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-success" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Permissão
          </p>
          <p className="mt-1 text-xs text-muted">
            Define o nível de acesso.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Building2 className="h-5 w-5 text-warning" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Empresa vinculada
          </p>
          <p className="mt-1 text-xs text-muted">
            Conta associada ao seu perfil.
          </p>
        </div>
      </div>
    </>
  );
}
