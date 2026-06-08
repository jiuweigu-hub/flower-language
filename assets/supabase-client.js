import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabaseConfigured,
} from "./supabase-config.js";

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export { supabaseConfigured };

export function makeSlug(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "entry"}-${Date.now().toString(36)}`;
}

export async function uploadFiles(files, userId, folder) {
  if (!files?.length) return [];

  const urls = [];
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("content-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from("content-media").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
