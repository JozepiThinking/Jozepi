export type InviteStatus = "pendente" | "usado" | "expirado" | "revogado";

export interface WorkshopInvite {
  id: string;
  token: string;
  workshop_id: string;
  created_by: string;
  email: string | null;
  status: InviteStatus;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export interface SignupInviteResult {
  valid: boolean;
  workshop_name?: string;
  email?: string | null;
  expires_at?: string;
  error?: "invalid" | "expired" | "used" | "revoked";
}

export function isMissingInvitesError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return (
    message.includes("invites") ||
    message.includes("get_signup_invite") ||
    message.includes("signup_requires_invite")
  );
}

export function getInviteDisplayStatus(invite: WorkshopInvite): InviteStatus {
  if (
    invite.status === "pendente" &&
    new Date(invite.expires_at).getTime() <= Date.now()
  ) {
    return "expirado";
  }

  return invite.status;
}

export function getInviteStatusLabel(status: InviteStatus) {
  if (status === "usado") return "Usado";
  if (status === "expirado") return "Expirado";
  if (status === "revogado") return "Revogado";
  return "Pendente";
}

export function buildInviteUrl(token: string, origin?: string) {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/cadastro?convite=${encodeURIComponent(token)}`;
}

export function getInviteLoginError(code: string | null | undefined) {
  if (code === "convite_expirado") {
    return "Este convite expirou. Peça um novo link para a oficina.";
  }
  if (code === "convite_usado") {
    return "Este convite já foi utilizado.";
  }
  if (code === "convite_revogado") {
    return "Este convite foi revogado.";
  }
  if (code === "convite_invalido") {
    return "Link de convite inválido.";
  }
  if (code === "convite") {
    return "Cadastro disponível apenas por convite.";
  }
  return null;
}

export function signupInviteErrorToLoginCode(
  error: SignupInviteResult["error"]
) {
  if (error === "expired") return "convite_expirado";
  if (error === "used") return "convite_usado";
  if (error === "revoked") return "convite_revogado";
  return "convite_invalido";
}
