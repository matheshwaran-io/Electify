import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

if (supabaseUrl === "https://placeholder.supabase.co") {
  console.warn("Supabase credentials missing. Realtime updates might not work.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
