"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_AGENDA_CAPACITY = 1;
const AGENDA_CAPACITY_STORAGE_KEY = "auto-estetica-agenda-capacity";

function isMissingAgendaCapacityError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return (
    message.includes("agenda_capacity") ||
    message.includes("schema cache") ||
    message.includes("Could not find")
  );
}

function normalizeCapacity(value: string | number | null | undefined) {
  const capacity =
    typeof value === "number" ? value : Number(String(value ?? "").trim());

  return Number.isFinite(capacity) && capacity > 0
    ? Math.floor(capacity)
    : DEFAULT_AGENDA_CAPACITY;
}

function getLocalAgendaCapacityKey(workshopId: string) {
  return `${AGENDA_CAPACITY_STORAGE_KEY}-${workshopId}`;
}

function readLocalAgendaCapacityForImport(workshopId: string) {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(getLocalAgendaCapacityKey(workshopId));
    return stored ? normalizeCapacity(stored) : null;
  } catch {
    return null;
  }
}

function clearLocalAgendaCapacity(workshopId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getLocalAgendaCapacityKey(workshopId));
}

export function AgendaCapacityCard() {
  const supabase = useMemo(() => createClient(), []);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(String(DEFAULT_AGENDA_CAPACITY));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCapacity = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (profileError || !profile?.workshop_id) {
      setError(profileError?.message ?? "Oficina não encontrada.");
      setLoading(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

    const { data: workshop, error: workshopError } = await supabase
      .from("workshops")
      .select("agenda_capacity")
      .eq("id", profile.workshop_id)
      .single();

    if (workshopError) {
      if (isMissingAgendaCapacityError(workshopError)) {
        setCapacity(String(DEFAULT_AGENDA_CAPACITY));
        setError(
          "A coluna agenda_capacity ainda não existe no Supabase. Aplique a migration 009."
        );
      } else {
        setError(workshopError.message);
      }
      setLoading(false);
      return;
    }

    const remoteCapacity = normalizeCapacity(workshop?.agenda_capacity);
    const localCapacity = readLocalAgendaCapacityForImport(profile.workshop_id);

    if (localCapacity !== null && localCapacity !== remoteCapacity) {
      const { error: importError } = await supabase
        .from("workshops")
        .update({ agenda_capacity: localCapacity })
        .eq("id", profile.workshop_id);

      if (!importError) {
        clearLocalAgendaCapacity(profile.workshop_id);
        setCapacity(String(localCapacity));
        setMessage("Capacidade local importada para o Supabase.");
        setLoading(false);
        return;
      }
    }

    if (localCapacity !== null) {
      clearLocalAgendaCapacity(profile.workshop_id);
    }

    setCapacity(String(remoteCapacity));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(loadCapacity);
  }, [loadCapacity]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const nextCapacity = normalizeCapacity(capacity);
    if (nextCapacity < 1) {
      setError("Informe uma capacidade maior que zero.");
      return;
    }

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("workshops")
      .update({ agenda_capacity: nextCapacity })
      .eq("id", workshopId);

    setSaving(false);

    if (updateError) {
      if (isMissingAgendaCapacityError(updateError)) {
        setError(
          "A coluna agenda_capacity ainda não existe no Supabase. Aplique a migration 009."
        );
      } else {
        setError(updateError.message);
      }
      return;
    }

    clearLocalAgendaCapacity(workshopId);
    setCapacity(String(nextCapacity));
    setMessage("Capacidade da agenda salva com sucesso.");
  }

  return (
    <form
      onSubmit={handleSave}
      className="card-surface"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-foreground">
            Capacidade simultânea
          </h2>
          <p className="mt-1 text-sm text-muted">
            Defina quantos carros podem ser atendidos no mesmo horário. A agenda
            só bloqueia um horário quando todas as vagas estiverem ocupadas.
          </p>
        </div>
        <div className="w-full lg:w-48">
          <Input
            label="Carros ao mesmo tempo"
            type="number"
            min="1"
            step="1"
            value={capacity}
            disabled={loading}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
          {message}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          type="submit"
          variant="success"
          loading={saving}
          disabled={loading || saving}
          className="w-full sm:w-auto"
        >
          Salvar capacidade
        </Button>
      </div>
    </form>
  );
}
