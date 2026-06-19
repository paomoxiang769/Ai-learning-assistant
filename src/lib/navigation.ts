export type MainNavigationIconId = "dashboard" | "documents" | "knowledge" | "review";

export type MainNavigationItem = {
  label: string;
  href: "/dashboard" | "/documents" | "/chat" | "/review";
  iconId: MainNavigationIconId;
};

export type WorkspaceTopbarViewModel = {
  section: string;
  title: string;
  actionLabel: string;
  actionHref: MainNavigationItem["href"];
  assistantStatus: string;
};

const MAIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    iconId: "dashboard",
  },
  {
    label: "Documents",
    href: "/documents",
    iconId: "documents",
  },
  {
    label: "Knowledge Base",
    href: "/chat",
    iconId: "knowledge",
  },
  {
    label: "Review Center",
    href: "/review",
    iconId: "review",
  },
];

export function getMainNavigationItems(): MainNavigationItem[] {
  return MAIN_NAVIGATION_ITEMS.map((item) => ({ ...item }));
}

export function getWorkspaceTopbarViewModel(
  currentPath: string,
): WorkspaceTopbarViewModel {
  const pathname = currentPath.split(/[?#]/)[0] || "/";
  const activeItem = MAIN_NAVIGATION_ITEMS.find((item) =>
    isMainNavigationItemActive(item.href, pathname),
  );

  if (activeItem) {
    return {
      section: "My workspace",
      title: activeItem.label,
      actionLabel:
        activeItem.href === "/dashboard" ? "Open documents" : "Open dashboard",
      actionHref: activeItem.href === "/dashboard" ? "/documents" : "/dashboard",
      assistantStatus: "AI workspace ready",
    };
  }

  if (pathname === "/" || pathname === "/login") {
    return {
      section: "AI Study Assistant",
      title: pathname === "/login" ? "Sign in" : "Home",
      actionLabel: "Open dashboard",
      actionHref: "/dashboard",
      assistantStatus: "AI workspace ready",
    };
  }

  if (pathname.startsWith("/quiz/")) {
    return {
      section: "My workspace",
      title: "Quiz",
      actionLabel: "Open dashboard",
      actionHref: "/dashboard",
      assistantStatus: "AI workspace ready",
    };
  }

  return {
    section: "My workspace",
    title: "Workspace",
    actionLabel: "Open dashboard",
    actionHref: "/dashboard",
    assistantStatus: "AI workspace ready",
  };
}

export function isMainNavigationItemActive(
  itemHref: MainNavigationItem["href"],
  currentPath: string,
): boolean {
  const pathname = currentPath.split(/[?#]/)[0] || "/";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
