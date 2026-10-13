import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Realtime is optional. Without a project URL and key, subscribers must not open
 * channels: the client would otherwise retry a WebSocket to a placeholder host
 * forever (console errors and a permanent "Reconnecting" status). Pages keep
 * working through their own refresh fallbacks.
 */
export const realtimeConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");
