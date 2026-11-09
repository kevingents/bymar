import type { StoreKey } from "./schemas";

type Store = { label: string; search: (q: string) => string };

const enc = encodeURIComponent;

export const STORES: Record<StoreKey, Store> = {
  ikea: { label: "IKEA", search: (q) => `https://www.ikea.com/nl/nl/search/?q=${enc(q)}` },
  gamma: { label: "GAMMA", search: (q) => `https://www.gamma.nl/zoeken?text=${enc(q)}` },
  praxis: { label: "Praxis", search: (q) => `https://www.praxis.nl/search?text=${enc(q)}` },
  karwei: { label: "Karwei", search: (q) => `https://www.karwei.nl/zoeken?text=${enc(q)}` },
  hornbach: { label: "HORNBACH", search: (q) => `https://www.hornbach.nl/s/${enc(q)}` },
  leenbakker: { label: "Leen Bakker", search: (q) => `https://www.leenbakker.nl/search?q=${enc(q)}` },
  kwantum: { label: "Kwantum", search: (q) => `https://www.kwantum.nl/search?q=${enc(q)}` },
  jysk: { label: "JYSK", search: (q) => `https://jysk.nl/search?query=${enc(q)}` },
  bol: { label: "bol", search: (q) => `https://www.bol.com/nl/nl/s/?searchtext=${enc(q)}` },
  overig: { label: "Google Shopping", search: (q) => `https://www.google.com/search?tbm=shop&q=${enc(q)}` },
};

export function storeLink(store: StoreKey, query: string) {
  const s = STORES[store] ?? STORES.overig;
  return { label: s.label, href: s.search(query) };
}

export function euro(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
