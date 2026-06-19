import { createStudyFlashcardsRoute } from "../../../../lib/study-flashcards-route";
import { generateStudyFlashcards } from "../../../../lib/study-flashcards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyFlashcardsRoute({
    createClient,
    generateFlashcards: generateStudyFlashcards,
  }).GET(request);
}

export async function DELETE(request: Request) {
  const { createClient } = await import("../../../../lib/supabase/server");

  return await createStudyFlashcardsRoute({
    createClient,
    generateFlashcards: generateStudyFlashcards,
  }).DELETE(request);
}
