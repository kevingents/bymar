"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { useUser } from "@/components/auth/AuthGate";

type Usage = { images: number; texts: number };

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 100;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-ink-3">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : "bg-olive"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const user = useUser();
  const [imageLimit, setImageLimit] = useState(40);
  const [textLimit, setTextLimit] = useState(150);
  const [usage, setUsage] = useState<Usage>({ images: 0, texts: 0 });
  const [saved, setSaved] = useState<"idle" | "busy" | "ok" | "error">("idle");

  useEffect(() => {
    const sb = supabase();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
    sb.from("user_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setImageLimit(data.daily_image_limit);
          setTextLimit(data.daily_text_limit);
        }
      });
    sb.from("ai_usage")
      .select("images, texts")
      .eq("day", today)
      .maybeSingle()
      .then(({ data }) => data && setUsage(data as Usage));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved("busy");
    const { error } = await supabase()
      .from("user_settings")
      .upsert({ user_id: user.id, daily_image_limit: imageLimit, daily_text_limit: textLimit, updated_at: new Date().toISOString() });
    setSaved(error ? "error" : "ok");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <Link href="/projecten" className="btn-ghost -ml-3 mt-2">
        <Icon name="arrow-left" size={18} /> Projecten
      </Link>
      <h1 className="mt-4 font-display text-3xl tracking-tight">Instellingen</h1>

      <section className="card mt-6 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Icon name="sparkles" size={20} className="text-accent" /> AI-gebruik vandaag
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Beelden en AI-vragen kosten tegoed. Met een daglimiet weet je zeker dat het niet onverwacht oploopt.
        </p>
        <div className="mt-4 space-y-3">
          <Meter label="Beelden (maken, restylen, 3D naar foto)" used={usage.images} limit={imageLimit} />
          <Meter label="AI-vragen (advies, bouwplannen, paletten, shop the look)" used={usage.texts} limit={textLimit} />
        </div>

        <form onSubmit={save} className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Beelden per dag</span>
            <input type="number" min={0} max={500} className="input" value={imageLimit} onChange={(e) => setImageLimit(Number(e.target.value) || 0)} />
          </label>
          <label className="block">
            <span className="label">AI-vragen per dag</span>
            <input type="number" min={0} max={2000} className="input" value={textLimit} onChange={(e) => setTextLimit(Number(e.target.value) || 0)} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn-primary" disabled={saved === "busy"}>
              <Icon name={saved === "busy" ? "loader" : "save"} size={18} /> Opslaan
            </button>
            {saved === "ok" && <span className="text-sm text-olive">Opgeslagen</span>}
            {saved === "error" && <span className="text-sm text-danger">Opslaan lukte niet</span>}
          </div>
        </form>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Icon name="user" size={20} className="text-accent" /> Account
        </h2>
        <p className="mt-1 text-sm text-ink-2">Ingelogd als {user.email}</p>
        <button className="btn-outline mt-4" onClick={() => supabase().auth.signOut()}>
          <Icon name="logout" size={18} /> Uitloggen
        </button>
      </section>
    </main>
  );
}
