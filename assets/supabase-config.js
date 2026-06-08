export const SUPABASE_URL = "https://aogksmdigxiosuldhict.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_D0asVI1iZPhI2Rn3OimCoA_XxxCHXWF";

export const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20;
