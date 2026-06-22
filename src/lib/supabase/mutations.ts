interface SupabaseMutationError {
  message: string;
}

export function assertMutationRows<T>(
  data: T[] | null,
  error: SupabaseMutationError | null,
  action: string
): T[] {
  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Não foi possível ${action}. Sua sessão pode ter expirado — recarregue a página e tente novamente.`
    );
  }

  return data;
}
