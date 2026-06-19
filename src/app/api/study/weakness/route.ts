import { createWeaknessDetectionRoute } from "../../../../lib/weakness-detection-route";
import { generateWeaknessDetection } from "../../../../lib/weakness-detection";

export const runtime = "nodejs";

export async function POST() {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createWeaknessDetectionRoute({
    createClient,
    generateWeaknesses: generateWeaknessDetection,
  }).POST();
}
