"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";

export const isConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext)!;

export function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="card p-6">
        <h1 className="font-display text-2xl">Nog even instellen</h1>
        <p className="mt-2 text-ink-2">
          Huisraad heeft een Supabase-project nodig. Zet <code>NEXT_PUBLIC_SUPABASE_URL</code> en{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code> (zie <code>.env.example</code>).
        </p>
      </div>
    </div>
  );
}

/** Laat de kinderen alleen zien als er een ingelogde gebruiker is; anders terug naar de start. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured()) return;
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (!data.user) router.replace(`/?next=${encodeURIComponent(window.location.pathname)}`);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) router.replace(`/?next=${encodeURIComponent(window.location.pathname)}`);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!isConfigured()) return <SetupNotice />;
  if (!user)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Icon name="loader" size={28} />
      </div>
    );
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
