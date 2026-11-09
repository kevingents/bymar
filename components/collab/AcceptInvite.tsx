"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

/** Neemt een uitnodiging aan en opent daarna het gedeelde project. */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .rpc("accept_invite", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data) setError(error?.message ?? "Deze uitnodiging werkt niet (meer).");
        else router.replace(`/projecten/${data}`);
      });
  }, [token, router]);

  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <Logo />
        {error ? (
          <>
            <p className="mt-6 text-ink-2">{error}</p>
            <Link href="/projecten" className="btn-outline mt-4">
              Naar je projecten
            </Link>
          </>
        ) : (
          <p className="mt-6 flex items-center justify-center gap-2 text-ink-2">
            <Icon name="loader" size={18} /> Je wordt toegevoegd aan het project…
          </p>
        )}
      </div>
    </main>
  );
}
