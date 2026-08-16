import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "company-logos";
export const COMPANY_LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const LOGO_MAX_DIMENSION = 512;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml"];

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou SVG.";
  }
  if (file.size > COMPANY_LOGO_MAX_SIZE) {
    return "O logo deve ter no máximo 2MB.";
  }
  return null;
}

// Rasterized logos are resized/re-encoded as PNG to preserve transparency
// (important for logos placed over colored PDF headers). SVGs are vector and
// already lightweight, so they're uploaded as-is.
function resizeLogoImage(file: File) {
  return new Promise<File>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(
        1,
        LOGO_MAX_DIMENSION / Math.max(image.width, image.height)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível processar o logo."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);

        if (!blob) {
          reject(new Error("Não foi possível processar o logo."));
          return;
        }

        const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
        resolve(
          new File([blob], `${baseName}.png`, {
            type: "image/png",
            lastModified: Date.now(),
          })
        );
      }, "image/png");
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível carregar o logo."));
    };

    image.src = objectUrl;
  });
}

export async function prepareLogoForUpload(file: File): Promise<File> {
  const validation = validateLogoFile(file);
  if (validation) throw new Error(validation);

  if (file.type === "image/svg+xml" || typeof window === "undefined") {
    return file;
  }

  return resizeLogoImage(file);
}

export async function uploadWorkshopLogo(
  supabase: SupabaseClient,
  workshopId: string,
  file: File
): Promise<string> {
  const uploadFile = await prepareLogoForUpload(file);
  const extension = uploadFile.type === "image/svg+xml" ? "svg" : "png";
  const path = `${workshopId}/logo-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, uploadFile, { contentType: uploadFile.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteWorkshopLogoByUrl(
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
