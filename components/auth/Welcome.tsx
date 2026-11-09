"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { isConfigured, SetupNotice } from "./AuthGate";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "sparkles", title: "Beelden met AI", text: "Beschrijf je droomkamer of restyle een foto van je eigen ruimte." },
  { icon: "chat", title: "Advies op maat", text: "Kleuren, indeling, materialen en budget: vraag het gewoon." },
  { icon: "hammer", title: "Zelf maken, A tot Z", text: "Materialen, zaaglijst, gereedschap en montage stap voor stap." },
  { icon: "plan", title: "Plattegrond en 3D", text: "Teken je kamer, richt hem in en loop er in 3D doorheen." },
  { icon: "cart", title: "Waar koop je het", text: "Inkooplijst met prijzen en directe links naar de winkels." },
  { icon: "share", title: "Opslaan en delen", text: "Bewaar je projecten en vraag vriendinnen om mee te kijken." },
];

export function Welcome() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured()) return;
    supabase()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace("/projecten");
      });
  }, [router]);

  if (!isConfigured()) return <SetupNotice />;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError("Dat lukte niet. Klopt je e-mailadres?");
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("Deze code klopt niet of is verlopen.");
    else router.replace("/projecten");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex items-center justify-between py-2">
        <Logo />
      </header>

      <section className="grid flex-1 items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Jouw interieur, van idee tot klaar</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Bedenk het, zie het, <em className="text-accent">maak het</em>.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-2">
            Huisraad helpt je met elk interieurproject: van inspiratie en advies tot een bouwplan voor je eigen kast en een
            3D-wandeling door je nieuwe kamer.
          </p>

          <div className="card mt-8 max-w-md p-5">
            {step === "email" ? (
              <form onSubmit={sendCode} className="space-y-3">
                <label className="label" htmlFor="email">
                  Inloggen of account maken
                </label>
                <input
                  id="email"
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
              </form>
            ) : (
              <form onSubmit={verify} className="space-y-3">
                <label className="label" htmlFor="code">
                  Code uit je mail
                </label>
                <p className="text-sm text-ink-2">
                  We hebben een mail gestuurd naar {email}. Typ de code over, of tik op de link in de mail.
                </p>
                <input
                  id="code"
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
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="card p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={f.icon} size={20} />
              </span>
              <h2 className="mt-3 font-medium">{f.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
