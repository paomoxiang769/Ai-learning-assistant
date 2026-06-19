import { createStudyPlanRoute } from "../../../../lib/study-plan-route";
import { generateStudyPlan } from "../../../../lib/study-plan";

export const runtime = "nodejs";

export async function POST() {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyPlanRoute({
    createClient,
    generatePlan: generateStudyPlan,
  }).POST();
}
