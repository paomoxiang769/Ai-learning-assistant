import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDocumentDeleteRoute } from "@/lib/document-delete-route";

type DeleteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: DeleteRouteContext) {
  return await createDocumentDeleteRoute({
    createClient,
  }).POST(request, context);
}
