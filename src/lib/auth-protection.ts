const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/documents",
  "/chat",
  "/review",
  "/quiz",
] as const;

const PROTECTED_API_PREFIXES = [
  "/api/documents",
  "/api/rag",
  "/api/study",
  "/api/chat",
] as const;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPagePath(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  );
}

export function isProtectedApiPath(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  );
}

export function getAuthRedirectPath(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (!isAuthenticated && isProtectedPagePath(pathname)) {
    return "/login";
  }

  if (isAuthenticated && pathname === "/login") {
    return "/dashboard";
  }

  return null;
}
