"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getMainNavigationItems,
  isMainNavigationItemActive,
  type MainNavigationIconId,
} from "@/lib/navigation";

function SidebarNavIcon({ iconId }: { iconId: MainNavigationIconId }) {
  switch (iconId) {
    case "dashboard":
      return <span className="emoji-icon">🏠</span>;
    case "documents":
      return <span className="emoji-icon">📂</span>;
    case "knowledge":
      return <span className="emoji-icon">💬</span>;
    case "review":
      return <span className="emoji-icon">📝</span>;
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const navigationItems = getMainNavigationItems();

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <Link className="sidebar-brand" href="/dashboard">
        <span className="sidebar-brand-mark" aria-hidden="true">
          AI
        </span>
        <span>
          <strong>MindPalette</strong>
          <small>AI Study Assistant</small>
        </span>
      </Link>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationItems.map((item) => {
          const isActive = isMainNavigationItemActive(item.href, pathname);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`sidebar-nav-link${isActive ? " is-active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                <SidebarNavIcon iconId={item.iconId} />
              </span>
              <span className="sidebar-nav-copy">
                <strong>{item.label}</strong>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
