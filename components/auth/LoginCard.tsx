"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { nextFromLocation } from "@/lib/next-path";

/** Inloggen met een e-mailcode (of de link in dezelfde mail). */
export function LoginCard({ id, title = "Inloggen of account maken" }: { id?: string; title?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextFromLocation())}` },
    });
    setBusy(false);
    if (error) setError("Dat lukte niet. Klopt je e-mailadres? Probeer het anders over een paar minuten opnieuw.");
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("Deze code klopt niet of is verlopen.");
    else router.replace(nextFromLocation());
  }

  return (
    <div id={id} className="card scroll-mt-24 p-5 shadow-xl shadow-black/5">
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="label" htmlFor={`${id ?? "login"}-email`}>
            {title}
          </label>
          <input
            id={`${id ?? "login"}-email`}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="input"
            placeholder="jij@voorbeeld.nl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Icon name="loader" size={18} /> : <Icon name="mail" size={18} />}
            Stuur me een inlogcode
          </button>
          <p className="text-center text-xs text-ink-3">Geen wachtwoord nodig. Gratis te gebruiken.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <label className="label" htmlFor={`${id ?? "login"}-code`}>
            Code uit je mail
          </label>
          <p className="text-sm text-ink-2">
            We hebben een mail gestuurd naar {email}. Typ de code over, of tik op de link in de mail.
          </p>
          <input
            id={`${id ?? "login"}-code`}
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            className="input text-center text-2xl tracking-[0.4em]"
            placeholder="000000"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Icon name="loader" size={18} /> : <Icon name="arrow-right" size={18} />}
            Inloggen
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep("email")}>
            Ander e-mailadres
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
