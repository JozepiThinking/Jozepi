"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, KeyRound, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  deleteProfilePhotoByUrl,
  uploadProfilePhoto,
} from "@/lib/supabase/profile-photo";

interface UserProfileCardProps {
  userId: string;
  email: string;
  fullName?: string | null;
  role?: string | null;
  companyName?: string | null;
  avatarUrl?: string | null;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {value || "Não informado"}
      </p>
    </div>
  );
}

export function UserProfileCard({
  userId,
  email,
  fullName,
  role,
  companyName,
  avatarUrl,
}: UserProfileCardProps) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [name, setName] = useState(fullName ?? "");
  const [savedName, setSavedName] = useState(fullName ?? "");
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const displayName = (editing ? name : savedName) || email || "Usuário";
  const initial = displayName.slice(0, 1).toUpperCase();

  async function handleSaveProfile() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome do usuário.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      setSavedName(trimmedName);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar o perfil."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não conferem.");
      return;
    }

    setSavingPassword(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Senha atualizada para testes.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Erro ao atualizar a senha."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function handlePhotoChange(file?: File) {
    if (!file) return;

    setUploadingPhoto(true);
    setPhotoError(null);

    try {
      const supabase = createClient();
      const previousAvatarUrl = savedAvatarUrl;
      const publicUrl = await uploadProfilePhoto(supabase, userId, file);
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) {
        throw updateError;
      }

      setSavedAvatarUrl(publicUrl);
      setPhotoMenuOpen(false);
      await deleteProfilePhotoByUrl(supabase, previousAvatarUrl);
      router.refresh();
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Erro ao atualizar a foto."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setPhotoMenuOpen((open) => !open)}
              disabled={uploadingPhoto}
              className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary transition-colors hover:bg-primary/20 disabled:cursor-wait disabled:opacity-70"
              title="Trocar foto"
              aria-label="Trocar foto do perfil"
            >
              {savedAvatarUrl ? (
                <Image
                  src={savedAvatarUrl}
                  alt="Foto do perfil"
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                initial
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 text-transparent transition-colors group-hover:bg-foreground/40 group-hover:text-white">
                <Camera className="h-5 w-5" />
              </span>
            </button>

            {photoMenuOpen && (
              <div className="absolute left-0 top-24 z-20 w-48 rounded-xl border border-border bg-card p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-background"
                >
                  <ImagePlus className="h-4 w-4 text-success" />
                  Escolher foto
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-background"
                >
                  <Camera className="h-4 w-4 text-success" />
                  Tirar foto agora
                </button>
              </div>
            )}

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                void handlePhotoChange(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              className="hidden"
              onChange={(event) => {
                void handlePhotoChange(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {displayName}
            </h2>
            <p className="mt-1 text-sm text-muted">{email}</p>
            {photoError && (
              <p className="mt-2 text-xs font-medium text-danger">
                {photoError}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setName(savedName);
            setError(null);
            setEditing(true);
          }}
          className="w-fit rounded-lg bg-success/10 p-2 text-success transition-colors hover:bg-success hover:text-white"
          title="Editar perfil"
          aria-label="Editar perfil"
        >
          <PencilLine className="h-4 w-4" />
        </button>
      </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {editing ? (
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <Input
                label="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={error ?? undefined}
                autoFocus
                className="bg-card"
              />
            </div>
          ) : (
            <InfoItem label="Nome" value={savedName} />
          )}
          <InfoItem label="E-mail" value={email} />
          <InfoItem label="Função" value={role} />
          <InfoItem label="Empresa" value={companyName} />
        </div>

      {editing && (
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setName(savedName);
              setError(null);
              setEditing(false);
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="success"
            loading={saving}
            onClick={handleSaveProfile}
          >
            Salvar
          </Button>
        </div>
      )}

      <form
        onSubmit={handleChangePassword}
        className="mt-6 rounded-xl border border-dashed border-warning/30 bg-warning/5 p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Senha de teste
            </h3>
            <p className="mt-1 text-xs text-muted">
              Altere rapidamente a senha desta conta. Depois podemos trocar por
              um fluxo com senha atual e confirmação por e-mail.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            minLength={6}
            className="bg-card"
          />
          <Input
            label="Confirmar senha"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
            minLength={6}
            className="bg-card"
          />
        </div>

        {passwordError && (
          <p className="mt-3 text-xs font-medium text-danger">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="mt-3 text-xs font-medium text-success">
            {passwordSuccess}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            variant="success"
            loading={savingPassword}
            disabled={!newPassword || !confirmPassword}
          >
            Trocar senha
          </Button>
        </div>
      </form>
    </div>
  );
}
