"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { validatePhotoFile } from "@/lib/supabase/vehicle-photos";

interface PhotoSlotProps {
  label: string;
  preview: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onError: (msg: string) => void;
  compact?: boolean;
}

function PhotoSlot({
  label,
  preview,
  onSelect,
  onRemove,
  onError,
  compact = false,
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validatePhotoFile(file);
    if (err) {
      onError(err);
      e.target.value = "";
      return;
    }
    onSelect(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted">{label}</span>
      {preview ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border border-border bg-input",
            compact ? "h-32 sm:h-36" : "h-64"
          )}
        >
          <Image
            src={preview}
            alt={label}
            fill
            className="object-contain p-1"
            unoptimized
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 rounded-full bg-foreground/70 p-1 text-white hover:bg-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-input text-muted transition-colors duration-300 hover:border-accent hover:text-accent",
            compact ? "h-32 sm:h-36" : "h-64"
          )}
        >
          <Camera className="h-5 w-5" />
          <span className="text-xs">Tirar ou carregar foto</span>
          <span className="text-[11px] text-muted/70">
            Câmera ou galeria
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

interface VehiclePhotoUploadProps {
  preview1: string | null;
  preview2: string | null;
  onPhoto1: (file: File) => void;
  onPhoto2: (file: File) => void;
  onRemove1: () => void;
  onRemove2: () => void;
  onError: (msg: string) => void;
  compact?: boolean;
}

export function VehiclePhotoUpload({
  preview1,
  preview2,
  onPhoto1,
  onPhoto2,
  onRemove1,
  onRemove2,
  onError,
  compact = false,
}: VehiclePhotoUploadProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted">
        Fotos do veículo (máx. 2)
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PhotoSlot
          label="Foto 1"
          preview={preview1}
          onSelect={onPhoto1}
          onRemove={onRemove1}
          onError={onError}
          compact={compact}
        />
        <PhotoSlot
          label="Foto 2"
          preview={preview2}
          onSelect={onPhoto2}
          onRemove={onRemove2}
          onError={onError}
          compact={compact}
        />
      </div>
      <p className="text-xs text-muted">
        JPG, PNG ou WEBP — até 10MB cada (comprimidas automaticamente no envio)
      </p>
    </div>
  );
}
