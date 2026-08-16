import { Header } from "@/components/layout/header";
import { UserProfileCard } from "@/components/profile/user-profile-card";
import { createClient } from "@/lib/supabase/server";
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
    </>
  );
}
