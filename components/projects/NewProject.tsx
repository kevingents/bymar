"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { emptyFloorplan } from "@/lib/floorplan";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { ProjectForm } from "./ProjectForm";

export function NewProject() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <Link href="/projecten" className="btn-ghost -ml-3 mt-2">
        <Icon name="arrow-left" size={18} /> Projecten
      </Link>
      <h1 className="mt-4 font-display text-3xl tracking-tight">Nieuw project</h1>
      <p className="mt-1 text-ink-2">Hoe meer je vertelt, hoe beter de beelden en het advies worden.</p>
      <div className="card mt-6 p-5 sm:p-6">
        <ProjectForm
          submitLabel="Project aanmaken"
          onSubmit={async (v) => {
            setError(null);
            const floorplan = emptyFloorplan();
            if (v.room_type) floorplan.rooms[0].name = v.room_type;
            const { data, error } = await supabase().from("projects").insert({ ...v, floorplan }).select("id").single();
            if (error || !data) setError("Opslaan lukte niet. Probeer het nog eens.");
            else router.replace(`/projecten/${data.id}`);
          }}
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </main>
  );
}
