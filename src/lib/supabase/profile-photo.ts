import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePhotoFile } from "@/lib/supabase/vehicle-photos";

const BUCKET = "vehicle-photos";

export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const validation = validatePhotoFile(file);
  if (validation) throw new Error(validation);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `profiles/${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProfilePhotoByUrl(
  supabase: SupabaseClient,
  url: string | null | undefined
) {
  if (!url) return;

  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;

  const path = decodeURIComponent(url.slice(idx + marker.length));
  await supabase.storage.from(BUCKET).remove([path]);
}
