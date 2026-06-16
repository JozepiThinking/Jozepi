import { AuthBranding } from "@/components/auth/auth-branding";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function RedefinirSenhaPage() {
  return (
    <>
      <AuthBranding />
      <AuthCard
        title="Redefinir senha"
        subtitle="Informe uma nova senha para acessar sua conta"
      >
        <ResetPasswordForm />
      </AuthCard>
    </>
  );
}
