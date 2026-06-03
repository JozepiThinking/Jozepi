"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Car } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandAutocomplete } from "@/components/clients/brand-autocomplete";
import { VehiclePhotoUpload } from "@/components/clients/vehicle-photo-upload";
import {
  type Client,
  type ClientFormData,
  type VehicleFormItem,
  emptyClientForm,
  emptyVehicle,
} from "@/types/client";

interface ClientFormModalProps {
  open: boolean;
  client?: Client | null;
  onClose: () => void;
  onSave: (data: ClientFormData) => Promise<void>;
}

function mapVehicleFromClient(v: NonNullable<Client["vehicles"]>[0]): VehicleFormItem {
  return {
    uiKey: v.id,
    id: v.id,
    brand: v.brand,
    model: v.model,
    plate: v.plate,
    year: v.year ? String(v.year) : "",
    photoUrl1: v.photo_url_1,
    photoUrl2: v.photo_url_2,
    photoFile1: null,
    photoFile2: null,
    previewUrl1: v.photo_url_1,
    previewUrl2: v.photo_url_2,
    removePhoto1: false,
    removePhoto2: false,
  };
}

function createVehicleItem(): VehicleFormItem {
  return {
    ...emptyVehicle,
    uiKey:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `vehicle-${Date.now()}-${Math.random()}`,
  };
}

function getVehicleKey(vehicle: VehicleFormItem, index: number) {
  return vehicle.uiKey ?? vehicle.id ?? `vehicle-${index}`;
}

export function ClientFormModal({
  open,
  client,
  onClose,
  onSave,
}: ClientFormModalProps) {
  const [form, setForm] = useState<ClientFormData>(emptyClientForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingVehicleKeys, setRemovingVehicleKeys] = useState<Set<string>>(
    new Set()
  );

  const isEditing = !!client;

  useEffect(() => {
    if (open) {
      setForm(
        client
          ? {
              name: client.name,
              phone: client.phone,
              notes: client.notes ?? "",
              vehicles: client.vehicles?.map(mapVehicleFromClient) ?? [],
            }
          : emptyClientForm
      );
      setError(null);
      setRemovingVehicleKeys(new Set());
    }

    return () => {
      form.vehicles.forEach((v) => {
        if (v.previewUrl1?.startsWith("blob:")) URL.revokeObjectURL(v.previewUrl1);
        if (v.previewUrl2?.startsWith("blob:")) URL.revokeObjectURL(v.previewUrl2);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  if (!open) return null;

  function updateField(field: "name" | "phone" | "notes", value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addVehicle() {
    setForm((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, createVehicleItem()],
    }));
  }

  function removeVehicle(index: number) {
    const vehicle = form.vehicles[index];
    const key = getVehicleKey(vehicle, index);

    setRemovingVehicleKeys((prev) => new Set(prev).add(key));

    window.setTimeout(() => {
      setForm((prev) => {
        const vehicleToRemove = prev.vehicles.find(
          (v, i) => getVehicleKey(v, i) === key
        );
        if (vehicleToRemove?.previewUrl1?.startsWith("blob:"))
          URL.revokeObjectURL(vehicleToRemove.previewUrl1);
        if (vehicleToRemove?.previewUrl2?.startsWith("blob:"))
          URL.revokeObjectURL(vehicleToRemove.previewUrl2);

        return {
          ...prev,
          vehicles: prev.vehicles.filter((v, i) => getVehicleKey(v, i) !== key),
        };
      });
      setRemovingVehicleKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 180);
  }

  function updateVehicle(index: number, patch: Partial<VehicleFormItem>) {
    setForm((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v, i) =>
        i === index ? { ...v, ...patch } : v
      ),
    }));
  }

  function handlePhoto1(index: number, file: File) {
    const vehicle = form.vehicles[index];
    if (vehicle.previewUrl1?.startsWith("blob:"))
      URL.revokeObjectURL(vehicle.previewUrl1);
    updateVehicle(index, {
      photoFile1: file,
      previewUrl1: URL.createObjectURL(file),
      removePhoto1: false,
    });
  }

  function handlePhoto2(index: number, file: File) {
    const vehicle = form.vehicles[index];
    if (vehicle.previewUrl2?.startsWith("blob:"))
      URL.revokeObjectURL(vehicle.previewUrl2);
    updateVehicle(index, {
      photoFile2: file,
      previewUrl2: URL.createObjectURL(file),
      removePhoto2: false,
    });
  }

  function removePhoto1(index: number) {
    const vehicle = form.vehicles[index];
    if (vehicle.previewUrl1?.startsWith("blob:"))
      URL.revokeObjectURL(vehicle.previewUrl1);
    updateVehicle(index, {
      photoFile1: null,
      previewUrl1: null,
      removePhoto1: true,
    });
  }

  function removePhoto2(index: number) {
    const vehicle = form.vehicles[index];
    if (vehicle.previewUrl2?.startsWith("blob:"))
      URL.revokeObjectURL(vehicle.previewUrl2);
    updateVehicle(index, {
      photoFile2: null,
      previewUrl2: null,
      removePhoto2: true,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Nome do cliente"
            required
          />

          <Input
            label="Telefone"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            required
          />

          <div className="space-y-3">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Car className="h-4 w-4 text-muted" />
                Veículos
              </label>
              <button
                type="button"
                onClick={addVehicle}
                className="group flex w-full items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-success/60 hover:bg-success/15 hover:shadow-md"
              >
                <span>
                  <span className="block text-sm font-semibold text-success">
                    Adicionar veículo
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Inclua marca, modelo, ano, placa e até 2 fotos
                  </span>
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-white transition-transform duration-200 group-hover:scale-110">
                  <Plus className="h-5 w-5" />
                </span>
              </button>
            </div>

            {form.vehicles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-3 text-center text-sm text-muted">
                Nenhum veículo adicionado
              </p>
            ) : (
              <div className="space-y-3">
                {form.vehicles.map((vehicle, index) => {
                  const vehicleKey = getVehicleKey(vehicle, index);
                  const isRemoving = removingVehicleKeys.has(vehicleKey);

                  return (
                    <div
                      key={vehicleKey}
                      className={`space-y-3 rounded-xl border border-border bg-background/30 p-4 transition-all duration-200 ${
                        isRemoving
                          ? "vehicle-card-exit pointer-events-none"
                          : "vehicle-card-enter"
                      }`}
                    >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">
                        Veículo {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeVehicle(index)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-danger/90 hover:shadow-md"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <BrandAutocomplete
                        label="Marca"
                        value={vehicle.brand}
                        onChange={(brand) =>
                          updateVehicle(index, { brand })
                        }
                        placeholder="Digite para buscar"
                      />
                      <Input
                        label="Modelo"
                        value={vehicle.model}
                        onChange={(e) =>
                          updateVehicle(index, { model: e.target.value })
                        }
                        placeholder="Corolla"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Placa"
                        value={vehicle.plate}
                        onChange={(e) =>
                          updateVehicle(index, {
                            plate: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="ABC-1D23"
                      />
                      <Input
                        label="Ano"
                        type="number"
                        min={1900}
                        max={new Date().getFullYear() + 1}
                        value={vehicle.year}
                        onChange={(e) =>
                          updateVehicle(index, { year: e.target.value })
                        }
                        placeholder="2020"
                      />
                    </div>

                    <VehiclePhotoUpload
                      preview1={vehicle.previewUrl1}
                      preview2={vehicle.previewUrl2}
                      onPhoto1={(file) => handlePhoto1(index, file)}
                      onPhoto2={(file) => handlePhoto2(index, file)}
                      onRemove1={() => removePhoto1(index)}
                      onRemove2={() => removePhoto2(index)}
                      onError={(msg) => setError(msg)}
                    />
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">
              Observações
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Anotações sobre o cliente..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" loading={loading}>
              {isEditing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
