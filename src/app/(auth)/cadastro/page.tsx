import { AuthBranding } from "@/components/auth/auth-branding";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export default function CadastroPage() {
  return (
    <>
      <AuthBranding />
      <AuthCard
        title="Crie sua conta"
        subtitle="Comece a gerenciar sua oficina em minutos"
      >
        <SignupForm />
      </AuthCard>
    </>
  );
}
