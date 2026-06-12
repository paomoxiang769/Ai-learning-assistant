export type MainNavigationItem = {
  label: string;
  href: "/dashboard" | "/documents" | "/chat" | "/review";
  iconLabel: string;
  description: string;
  tag: "AI" | "Core" | null;
};

export type SidebarWorkspaceStatus = {
  eyebrow: string;
  title: string;
  description: string;
  meterLabel: string;
  meterValue: number;
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
    iconLabel: "DB",
    description: "Bento study overview",
    tag: null,
  },
  {
    label: "Documents",
    href: "/documents",
    iconLabel: "DS",
    description: "Source library",
    tag: "Core",
  },
  {
    label: "Knowledge Base",
    href: "/chat",
    iconLabel: "KB",
    description: "Cross-document chat",
    tag: "AI",
  },
  {
    label: "Review Center",
    href: "/review",
    iconLabel: "RV",
    description: "History and notes",
    tag: null,
  },
];

const SIDEBAR_WORKSPACE_STATUS: SidebarWorkspaceStatus = {
  eyebrow: "Study workspace",
  title: "AI learning loop",
  description: "Upload, ask, quiz, note, and review from one focused space.",
  meterLabel: "Review readiness",
  meterValue: 70,
};

export function getMainNavigationItems(): MainNavigationItem[] {
  return MAIN_NAVIGATION_ITEMS.map((item) => ({ ...item }));
}

export function getSidebarWorkspaceStatus(): SidebarWorkspaceStatus {
  return { ...SIDEBAR_WORKSPACE_STATUS };
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
