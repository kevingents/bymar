import { supabaseServer } from "@/lib/supabase/server";

/** Haalt titel en voorbeeldbeeld (og:image) van een link op, voor het moodboard. */
export async function GET(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Niet ingelogd." }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return Response.json({ error: "Ongeldige link." }, { status: 400 });
  }
  const host = target.hostname.toLowerCase();
  const isIp = /^[\d.]+$/.test(host) || host.includes(":");
  if (!/^https?:$/.test(target.protocol) || isIp || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return Response.json({ error: "Deze link kan ik niet openen." }, { status: 400 });
  }

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HuisraadBot/1.0; +https://www.huisraad.app)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (html.length < 400_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
    }
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
    const decode = (s?: string) => s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const title = decode(meta("og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]);
    let image = decode(meta("og:image") ?? meta("twitter:image"));
    if (image) image = new URL(image, res.url).toString();
    return Response.json({ title: title?.slice(0, 200) ?? host, image: image?.startsWith("https://") ? image : null });
  } catch {
    return Response.json({ title: host, image: null });
  }
}
