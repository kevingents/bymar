import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/next-path";

/** Landingsplek voor de inloglink uit de mail (naast de 6-cijferige code). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const sb = await supabaseServer();

  let ok = false;
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const next = safeNext(url.searchParams.get("next"));
  return NextResponse.redirect(new URL(ok ? next : `/?login=mislukt&next=${encodeURIComponent(next)}`, url.origin));
}
