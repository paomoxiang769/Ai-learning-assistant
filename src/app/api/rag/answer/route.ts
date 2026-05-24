import { answerQuestion } from "../../../../lib/rag-answer";
import { createRagAnswerRoute } from "../../../../lib/rag-answer-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createRagAnswerRoute({
    createClient,
    answerQuestion,
  })(request);
}
