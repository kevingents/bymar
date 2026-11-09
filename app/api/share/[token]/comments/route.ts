import { supabasePublic } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { name, body } = (await req.json()) as { name?: string; body?: string };
  if (!name?.trim() || !body?.trim()) {
    return Response.json({ error: "Vul je naam en een reactie in." }, { status: 400 });
  }

  const { data, error } = await supabasePublic().rpc("add_shared_comment", {
    p_token: token,
    p_name: name,
    p_body: body,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "54000" ? 429 : 400;
    return Response.json({ error: error.message || "Reactie kon niet worden geplaatst." }, { status });
  }
  return Response.json({ comment: data });
}
