"use client";

import { BUCKET, supabase } from "./supabase/client";

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Er ging iets mis.");
  return data as T;
}

/** Verkleint een foto in de browser (max 2000 px, JPEG) zodat uploaden en AI sneller gaan. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Uploadt een foto naar de privé opslag onder <user>/<project>/ en geeft het pad terug. */
export async function uploadPhoto(userId: string, projectId: string, file: File) {
  const blob = await shrink(file);
  const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
  const path = `${userId}/${projectId}/upload-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type || "image/jpeg" });
  if (error) throw new Error("Uploaden lukte niet.");
  return path;
}
