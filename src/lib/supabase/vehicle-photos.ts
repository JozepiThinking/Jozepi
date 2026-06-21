import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "vehicle-photos";
export const VEHICLE_PHOTO_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const VEHICLE_PHOTO_MAX_DIMENSION = 1920;
const VEHICLE_PHOTO_QUALITY = 0.82;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function formatStorageError(message: string) {
  if (message.includes("maximum allowed size")) {
    return "A foto é grande demais para o armazenamento. Aplique a migration 012 no Supabase ou use uma imagem menor.";
  }

  return message;
}

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use JPG, PNG ou WEBP.";
  }
  if (file.size > VEHICLE_PHOTO_MAX_SIZE) {
    return "A foto deve ter no máximo 10MB.";
  }
  return null;
}

function resizeVehiclePhoto(file: File) {
  return new Promise<File>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(
        1,
        VEHICLE_PHOTO_MAX_DIMENSION / Math.max(image.width, image.height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível processar a foto."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            reject(new Error("Não foi possível processar a foto."));
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
          resolve(
            new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        VEHICLE_PHOTO_QUALITY
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível carregar a foto."));
    };

    image.src = objectUrl;
  });
}

export async function preparePhotoForUpload(file: File) {
  const validation = validatePhotoFile(file);
  if (validation) throw new Error(validation);

  if (typeof window === "undefined") {
    return file;
  }

  return resizeVehiclePhoto(file);
}

export async function uploadVehiclePhoto(
  supabase: SupabaseClient,
  workshopId: string,
  vehicleId: string,
  file: File,
  slot: 1 | 2
): Promise<string> {
  const uploadFile = await preparePhotoForUpload(file);
  const path = `${workshopId}/${vehicleId}/photo_${slot}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, uploadFile, { upsert: true, contentType: "image/jpeg" });

  if (error) throw new Error(formatStorageError(error.message));

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteVehiclePhotoByUrl(
  supabase: SupabaseClient,
  url: string | null | undefined
) {
  if (!url) return;

  const marker = `/vehicle-photos/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = decodeURIComponent(url.slice(idx + marker.length));
  await supabase.storage.from(BUCKET).remove([path]);
}
