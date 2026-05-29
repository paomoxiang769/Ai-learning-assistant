import { createStudyQuizRoute } from "../../../../lib/study-quiz-route";
import { generateStudyQuiz } from "../../../../lib/study-quiz";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyQuizRoute({
    createClient,
    generateQuiz: generateStudyQuiz,
  })(request);
}
