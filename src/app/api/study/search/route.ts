import { generateEmbedding } from "../../../../lib/embedding";
import { createSemanticSearchRoute } from "../../../../lib/semantic-search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createSemanticSearchRoute({
    createClient,
    generateEmbedding,
  }).POST(request);
}
