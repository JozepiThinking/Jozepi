export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    throw new Error("Informe um telefone válido com DDD.");
  }

  return formatPhone(digits);
}

export function normalizeOptionalPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  return normalizePhone(trimmed);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function getWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const phoneWithCountryCode = digits.startsWith("55") ? digits : `55${digits}`;

  return `https://wa.me/${phoneWithCountryCode}`;
}
