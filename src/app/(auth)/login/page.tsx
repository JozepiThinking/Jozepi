import { AuthBranding } from "@/components/auth/auth-branding";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <>
      <AuthBranding />
      <AuthCard
        title="Bem-vindo de volta"
        subtitle="Entre na sua conta para continuar"
      >
        <LoginForm inviteErrorCode={erro} />
      </AuthCard>
    </>
  );
}
