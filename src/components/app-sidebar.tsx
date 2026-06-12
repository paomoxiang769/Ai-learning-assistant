"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getMainNavigationItems,
  getSidebarWorkspaceStatus,
  isMainNavigationItemActive,
} from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();
  const navigationItems = getMainNavigationItems();
  const workspaceStatus = getSidebarWorkspaceStatus();

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div>
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
                  {item.iconLabel}
                </span>
                <span className="sidebar-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {item.tag ? (
                  <span className="sidebar-nav-tag">{item.tag}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="sidebar-status-card" aria-label="Workspace status">
        <p>{workspaceStatus.eyebrow}</p>
        <h2>{workspaceStatus.title}</h2>
        <span>{workspaceStatus.description}</span>
        <div className="sidebar-status-meter" aria-label={workspaceStatus.meterLabel}>
          <div>
            <span>{workspaceStatus.meterLabel}</span>
            <strong>{workspaceStatus.meterValue}%</strong>
          </div>
          <meter max={100} min={0} value={workspaceStatus.meterValue} />
        </div>
      </section>
    </aside>
  );
}
