/** Alleen interne paden toestaan als terugkeeradres na het inloggen. */
export function safeNext(raw: string | null | undefined, fallback = "/projecten") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

export function nextFromLocation(fallback = "/projecten") {
  if (typeof window === "undefined") return fallback;
  return safeNext(new URLSearchParams(window.location.search).get("next"), fallback);
}
