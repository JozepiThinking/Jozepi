import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "vehicle-photos";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use JPG, PNG ou WEBP.";
  }
  if (file.size > MAX_SIZE) {
    return "A foto deve ter no máximo 5MB.";
  }
  return null;
}

export async function uploadVehiclePhoto(
  supabase: SupabaseClient,
  workshopId: string,
  vehicleId: string,
  file: File,
  slot: 1 | 2
): Promise<string> {
  const validation = validatePhotoFile(file);
  if (validation) throw new Error(validation);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${workshopId}/${vehicleId}/photo_${slot}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

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
