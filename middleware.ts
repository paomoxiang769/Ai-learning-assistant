import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const isPagePost =
    request.method === "POST" && !request.nextUrl.pathname.startsWith("/api/");

  if (isPagePost) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.set(
      "error",
      "This form changed after an update. Please submit it again.",
    );

    return NextResponse.redirect(redirectUrl);
  }

  const { response, user } = await updateSession(request);

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/documents");

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";

    const redirectResponse = NextResponse.redirect(redirectUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
