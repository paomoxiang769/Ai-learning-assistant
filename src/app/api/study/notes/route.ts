import { createStudyNotesRoute } from "../../../../lib/study-notes-route";
import { generateStudyNotes } from "../../../../lib/study-notes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyNotesRoute({
    createClient,
    generateNotes: generateStudyNotes,
  }).POST(request);
}

export async function GET(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyNotesRoute({
    createClient,
    generateNotes: generateStudyNotes,
  }).GET(request);
}

export async function DELETE(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyNotesRoute({
    createClient,
    generateNotes: generateStudyNotes,
  }).DELETE(request);
}
