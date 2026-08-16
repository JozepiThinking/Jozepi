export function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  let result = digits;
  if (digits.length > 2) result = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5)
    result = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length > 8)
    result = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  if (digits.length > 12)
    result = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;

  return result;
}

export function isCnpjComplete(value: string): boolean {
  return value.replace(/\D/g, "").length === 14;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const isMobile = digits.length > 10;
  const middleLength = isMobile ? 5 : 4;

  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : digits;
  }

  const areaCode = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= middleLength) {
    return `(${areaCode}) ${rest}`;
  }

  return `(${areaCode}) ${rest.slice(0, middleLength)}-${rest.slice(middleLength)}`;
}
