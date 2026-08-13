"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface CompanyInfo {
  name: string;
  document: string;
  phone: string;
  address: string;
}

const EMPTY_COMPANY_INFO: CompanyInfo = {
  name: "",
  document: "",
  phone: "",
  address: "",
};

export function CompanyInfoCard() {
  const supabase = useMemo(() => createClient(), []);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyInfo>(EMPTY_COMPANY_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCompanyInfo = useCallback(async () => {
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
      .select("name, document, phone, address")
      .eq("id", profile.workshop_id)
      .single();

    if (workshopError) {
      setError(workshopError.message);
      setLoading(false);
      return;
    }

    setForm({
      name: workshop?.name ?? "",
      document: workshop?.document ?? "",
      phone: workshop?.phone ?? "",
      address: workshop?.address ?? "",
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(loadCompanyInfo);
  }, [loadCompanyInfo]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!workshopId) {
      setError("Oficina não encontrada.");
      return;
    }

    if (!form.name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("workshops")
      .update({
        name: form.name.trim(),
        document: form.document.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      })
      .eq("id", workshopId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Dados da empresa salvos com sucesso.");
  }

  return (
    <form onSubmit={handleSave} className="card-surface">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-premium/10 text-premium">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dados da empresa</h2>
          <p className="mt-1 text-sm text-muted">
            Usados no cabeçalho dos comprovantes em PDF gerados em Relatórios.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Nome da empresa"
          value={form.name}
          disabled={loading}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <Input
          label="CNPJ / Documento"
          placeholder="00.000.000/0000-00"
          value={form.document}
          disabled={loading}
          onChange={(event) => setForm((prev) => ({ ...prev, document: event.target.value }))}
        />
        <Input
          label="Telefone"
          placeholder="(00) 00000-0000"
          value={form.phone}
          disabled={loading}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
        />
        <Input
          label="Endereço"
          placeholder="Rua, número, bairro, cidade"
          value={form.address}
          disabled={loading}
          onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
        />
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
          Salvar dados da empresa
        </Button>
      </div>
    </form>
  );
}
