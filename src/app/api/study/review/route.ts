import { createStudyReviewRoute } from "../../../../lib/study-review-route";
import { generateReviewAdvice } from "../../../../lib/study-review";

export const runtime = "nodejs";

export async function POST() {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyReviewRoute({
    createClient,
    generateAdvice: generateReviewAdvice,
  }).POST();
}
