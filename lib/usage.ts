import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Telt een AI-aanroep op tegen de daglimiet (in te stellen bij Instellingen).
 * Geeft een foutresponse terug als de limiet bereikt is, anders null.
 */
export async function guardAi(sb: SupabaseClient, kind: "image" | "text") {
  const { data, error } = await sb.rpc("use_ai", { p_kind: kind });
  if (error) {
    console.error("ai-limiet controleren mislukt", error);
    return null; // niet blokkeren op een telfout
  }
  const r = data as { ok: boolean; used: number; limit: number };
  if (r.ok) return null;
  const wat = kind === "image" ? "beelden" : "AI-vragen";
  return Response.json(
    { error: `Je daglimiet van ${r.limit} ${wat} is bereikt. Morgen kan het weer, of verhoog de limiet bij Instellingen.` },
    { status: 429 },
  );
}
