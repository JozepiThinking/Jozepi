"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Car,
  ClipboardList,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ClientFormModal } from "@/components/clients/client-form-modal";
import { formatDate, formatPhone, getWhatsAppUrl } from "@/lib/utils/format";
import { syncVehicles } from "@/lib/clients/sync-vehicles";
import { type Client, type ClientFormData } from "@/types/client";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.52 3.48A11.78 11.78 0 0 0 12.1 0C5.57 0 .25 5.3.25 11.82c0 2.08.55 4.12 1.59 5.91L.15 24l6.43-1.68a11.9 11.9 0 0 0 5.52 1.4h.01c6.53 0 11.85-5.3 11.85-11.82 0-3.16-1.22-6.13-3.44-8.42Zm-8.41 18.24h-.01a9.85 9.85 0 0 1-5.02-1.37l-.36-.22-3.82 1 1.02-3.72-.24-.38a9.8 9.8 0 0 1-1.5-5.21C2.18 6.4 6.63 2 12.12 2a9.77 9.77 0 0 1 6.99 2.9 9.84 9.84 0 0 1 2.9 7c0 5.42-4.45 9.82-9.9 9.82Zm5.43-7.36c-.3-.15-1.76-.87-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

const clientInfoCardClass =
  "inline-flex h-11 min-w-[12rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium shadow-sm";

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadClients = useCallback(async () => {
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

    const { data, error } = await supabase
      .from("clients")
      .select(
        "*, vehicles(id, client_id, brand, model, plate, year, photo_url_1, photo_url_2)"
      )
      .eq("workshop_id", profile.workshop_id)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
    } else {
      setClients((data as Client[]) ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = clients.filter((client) => {
    const term = search.toLowerCase();
    const vehicleMatch = client.vehicles?.some(
      (v) =>
        v.plate.toLowerCase().includes(term) ||
        v.brand.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term)
    );
    return (
      client.name.toLowerCase().includes(term) ||
      client.phone.includes(term) ||
      vehicleMatch
    );
  });

  function openCreateModal() {
    setEditingClient(null);
    setModalOpen(true);
  }

  function openEditModal(client: Client) {
    setEditingClient(client);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingClient(null);
  }

  async function handleSave(data: ClientFormData) {
    if (!workshopId) throw new Error("Oficina não encontrada.");

    const payload = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      notes: data.notes.trim() || null,
    };

    if (editingClient) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingClient.id);

      if (error) throw new Error(error.message);

      await syncVehicles(
        supabase,
        workshopId,
        editingClient.id,
        data.vehicles,
        editingClient.vehicles?.map((v) => v.id) ?? []
      );
    } else {
      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({ ...payload, workshop_id: workshopId })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      await syncVehicles(supabase, workshopId, newClient.id, data.vehicles);
    }

    await loadClients();
  }

  async function handleDelete(client: Client) {
    const confirmed = window.confirm(
      `Deseja excluir o cliente "${client.name}"?`
    );
    if (!confirmed) return;

    setDeletingId(client.id);
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);

    if (error) {
      alert("Erro ao excluir cliente.");
    } else {
      await loadClients();
    }
    setDeletingId(null);
  }

  return (
    <>
      <Header
        title="Clientes"
        description="Gerencie o cadastro de clientes"
        actions={
          <Button variant="success" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Adicionar novo cliente
          </Button>
        }
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted shadow-sm">
          Carregando clientes...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium text-foreground">
            {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </p>
          {!search && (
            <Button
              variant="success"
              className="mt-4"
              onClick={openCreateModal}
            >
              <Plus className="h-4 w-4" />
              Adicionar novo cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredClients.map((client) => {
            const vehicleCount = client.vehicles?.length ?? 0;

            return (
              <article
                key={client.id}
                className="relative rounded-xl border border-border bg-slate-50 p-5 pb-12 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(client)}
                    className="rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white"
                    title="Editar cliente"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(client)}
                    disabled={deletingId === client.id}
                    className="rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-50"
                    title="Excluir cliente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="pr-24">
                  <h2 className="text-lg font-semibold text-foreground">
                    {client.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                    <a
                      href={getWhatsAppUrl(client.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${clientInfoCardClass} text-[#128C7E] transition-all hover:-translate-y-0.5 hover:border-[#25D366] hover:bg-[#25D366] hover:text-white hover:shadow-md`}
                      title="Abrir conversa no WhatsApp"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                      <span>{formatPhone(client.phone)}</span>
                    </a>
                    <span
                      className={`${clientInfoCardClass} text-primary`}
                    >
                      <Car className="h-4 w-4" />
                      {vehicleCount} veículo{vehicleCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/servicos?clientId=${client.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
                >
                  <ClipboardList className="h-4 w-4" />
                  Criar serviço com cliente
                </Link>
                {client.notes && (
                  <p className="mt-4 line-clamp-2 rounded-lg bg-background/70 px-3 py-2 text-sm text-muted">
                    {client.notes}
                  </p>
                )}
                <span className="absolute bottom-4 right-5 text-xs font-medium text-muted">
                  Cadastrado em {formatDate(client.created_at)}
                </span>
              </article>
            );
          })}
        </div>
      )}

      {!loading && clients.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          {filteredClients.length} de {clients.length} cliente
          {clients.length !== 1 ? "s" : ""}
        </p>
      )}

      <ClientFormModal
        open={modalOpen}
        client={editingClient}
        onClose={closeModal}
        onSave={handleSave}
      />
    </>
  );
}
