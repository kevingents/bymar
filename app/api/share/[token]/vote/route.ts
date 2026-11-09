import { supabasePublic } from "@/lib/supabase/server";

/** Hartje op een beeld via de deellink. De stemmer is een willekeurige id uit de browser. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { imageId, voter, on } = (await req.json()) as { imageId?: string; voter?: string; on?: boolean };
  if (!imageId || !voter || voter.length < 8 || voter.length > 64) {
    return Response.json({ error: "Ongeldige stem." }, { status: 400 });
  }
  const { data, error } = await supabasePublic().rpc("vote_shared_image", {
    p_token: token,
    p_image: imageId,
    p_voter: voter,
    p_on: on !== false,
  });
  if (error) return Response.json({ error: "Stemmen lukte niet." }, { status: error.code === "P0002" ? 404 : 400 });
  return Response.json({ votes: data });
}
