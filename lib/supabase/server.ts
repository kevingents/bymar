import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const BUCKET = "huisraad";

/** Supabase met de sessie van de ingelogde gebruiker (RLS geldt). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            // In een server component mag je geen cookies zetten; de proxy ververst de sessie.
          }
        },
      },
    },
  );
}

/** Zonder sessie, voor de deellink. Leest alleen via de functies shared_project / add_shared_comment. */
export function supabasePublic() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Haalt de gebruiker en een project op dat van die gebruiker is, of geeft een foutresponse. */
export async function requireProject(projectId: string) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: Response.json({ error: "Je bent niet ingelogd." }, { status: 401 }) } as const;
  const { data: project } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (!project) return { error: Response.json({ error: "Project niet gevonden." }, { status: 404 }) } as const;
  return { sb, user, project } as const;
}
