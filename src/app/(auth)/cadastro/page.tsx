import { AuthBranding } from "@/components/auth/auth-branding";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import {
  isMissingInvitesError,
  signupInviteErrorToLoginCode,
  type SignupInviteResult,
} from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const { convite } = await searchParams;
  const token = convite?.trim() ?? "";
  const supabase = await createClient();

  if (!token) {
    const { data: requiresInvite, error } = await supabase.rpc(
      "signup_requires_invite"
    );

    if (error && isMissingInvitesError(error)) {
      redirect("/login?erro=convite");
    }

    if (error || requiresInvite) {
      redirect("/login?erro=convite");
    }

    return (
      <>
        <AuthBranding />
        <AuthCard
          title="Crie sua conta"
          subtitle="Primeira oficina deste sistema — depois o cadastro será só por convite"
        >
          <SignupForm mode="bootstrap" />
        </AuthCard>
      </>
    );
  }

  const { data, error } = await supabase.rpc("get_signup_invite", {
    p_token: token,
  });

  if (error) {
    redirect("/login?erro=convite_invalido");
  }

  const invite = (data ?? {}) as SignupInviteResult;

  if (!invite.valid) {
    redirect(`/login?erro=${signupInviteErrorToLoginCode(invite.error)}`);
  }

  return (
    <>
      <AuthBranding />
      <AuthCard
        title="Crie sua conta"
        subtitle="Use o convite para entrar na oficina sem criar uma nova"
      >
        <SignupForm
          mode="invite"
          inviteToken={token}
          workshopName={invite.workshop_name}
          lockedEmail={invite.email ?? null}
        />
      </AuthCard>
    </>
  );
}
