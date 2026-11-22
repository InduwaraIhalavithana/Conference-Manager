"use client";

import { csrfToken } from "@/lib/graphql/client";

export type ImageKind = "cover" | "speaker" | "avatar";

/** Size limits in MB, kept in step with api/app/services/uploads.py. */
export const UPLOAD_MAX_MB: Record<ImageKind, number> = { cover: 5, speaker: 2, avatar: 2 };
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadResult = { url: string } | { error: "type" | "size" | string };

/** Checks type and size in the browser first, then uploads; the API re-encodes the image to WebP. */
export async function uploadImage(kind: ImageKind, file: File): Promise<UploadResult> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: "type" };
  if (file.size > UPLOAD_MAX_MB[kind] * 1024 * 1024) return { error: "size" };
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/upload?kind=${kind}`, {
    method: "POST",
    body,
    headers: { "X-CSRF-Token": await csrfToken() },
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; code?: string };
  return json.url ? { url: json.url } : { error: json.code ?? "server" };
}

/** The message for a failed upload, in the reader's language. */
export function uploadErrorText(
  t: (key: string, values?: Record<string, string | number>) => string,
  kind: ImageKind,
  file: File,
  error: string,
): string {
  if (error === "type") return t("upload_bad_type");
  if (error === "size") return t("upload_too_big", { size: (file.size / 1024 / 1024).toFixed(1), max: UPLOAD_MAX_MB[kind] });
  return t(`err_${error.toLowerCase()}`);
}
