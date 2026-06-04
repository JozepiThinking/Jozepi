"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Pencil, Plus, Power, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";

interface ServiceItem {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  price: number | string;
  duration_minutes: number | null;
  active: boolean;
}

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
}

const emptyForm: ServiceForm = {
  name: "",
  description: "",
  price: "",
  durationMinutes: "60",
};

const durationOptions = Array.from({ length: 16 }, (_, index) => {
  const minutes = 30 + index * 30;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return {
    value: String(minutes),
    label:
      hours === 0
        ? "30 min"
        : remainingMinutes === 0
          ? `${hours}h`
          : `${hours}h30`,
  };
});

function parsePrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Informe um preço válido.");
  }

  return price;
}

function parseDuration(value: string) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error("Informe uma duração válida.");
  }

  return duration;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "0h";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

export function ServicesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function loadServices() {
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("workshop_id")
      .single();

    if (!profile?.workshop_id) {
      setLoading(false);
      return;
    }

    setWorkshopId(profile.workshop_id);

    const { data, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("workshop_id", profile.workshop_id)
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    if (servicesError) {
      setError(servicesError.message);
    } else {
      setServices((data as ServiceItem[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void Promise.resolve().then(loadServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreateForm() {
    setEditingService(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(service: ServiceItem) {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description ?? "",
      price: String(service.price ?? ""),
      durationMinutes: String(service.duration_minutes ?? 60),
    });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingService(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(false);
  }

  async function handleSaveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    if (!form.name.trim()) {
      setError("Informe o nome do serviço.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parsePrice(form.price || "0"),
        duration_minutes: parseDuration(form.durationMinutes),
      };

      if (editingService) {
        const { error: updateError } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("services").insert({
          ...payload,
          workshop_id: workshopId,
        });

        if (insertError) throw insertError;
      }

      await loadServices();
      closeForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar o serviço."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(service: ServiceItem) {
    const { error: updateError } = await supabase
      .from("services")
      .update({ active: !service.active })
      .eq("id", service.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await loadServices();
  }

  async function handleDeleteService(service: ServiceItem) {
    const confirmed = window.confirm(
      `Deseja excluir o serviço ${service.name}?`
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("services")
      .delete()
      .eq("id", service.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadServices();
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button variant="success" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSaveService}
          autoComplete="off"
          className="mb-6 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editingService ? "Editar serviço" : "Novo serviço"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Cadastre os serviços que poderão ser usados na agenda.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-background hover:text-foreground"
              aria-label="Fechar formulário"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome do serviço"
              value={form.name}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Lavagem completa"
            />
            <Input
              label="Preço base"
              value={form.price}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, price: event.target.value }))
              }
              placeholder="150,00"
            />
            <div className="space-y-1.5">
              <label
                htmlFor="service-duration"
                className="block text-sm font-semibold text-foreground"
              >
                Duração em horas
              </label>
              <select
                id="service-duration"
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    durationMinutes: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Descrição"
              value={form.description}
              autoComplete="off"
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Detalhes do serviço"
            />
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" loading={saving}>
              Salvar serviço
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted shadow-sm">
          Carregando serviços...
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <Wrench className="h-7 w-7 text-success" />
          </div>
          <p className="font-medium text-foreground">
            Nenhum serviço cadastrado
          </p>
          <p className="mt-1 text-sm text-muted">
            Crie sua lista para usar os serviços na agenda.
          </p>
          <Button variant="success" className="mt-4" onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Novo serviço
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.id}
              className={`rounded-xl border border-border bg-card p-5 shadow-sm ${
                service.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-foreground">
                      {service.name}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        service.active
                          ? "bg-success/10 text-success"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {service.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  {service.description && (
                    <p className="mt-1 text-sm text-muted">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(service)}
                    className="rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white"
                    title="Editar serviço"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteService(service)}
                    className="rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white"
                    title="Excluir serviço"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-lg bg-background px-3 py-2 font-semibold text-foreground">
                  {formatCurrency(Number(service.price))}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-2 font-medium text-muted">
                  <Clock className="h-4 w-4" />
                  {formatDuration(service.duration_minutes)}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(service)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 font-medium text-muted transition-colors hover:text-foreground"
                >
                  <Power className="h-4 w-4" />
                  {service.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
