import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthRedirectPath,
  isProtectedApiPath,
} from "@/lib/auth-protection";
import { updateSession } from "@/lib/supabase/middleware";

function copyResponseCookies(
  source: NextResponse,
  target: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

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
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = Boolean(user);

  if (isProtectedApiPath(pathname) && !isAuthenticated) {
    return copyResponseCookies(
      response,
      NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    );
  }

  const authRedirectPath = getAuthRedirectPath(pathname, isAuthenticated);

  if (authRedirectPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = authRedirectPath;

    return copyResponseCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
