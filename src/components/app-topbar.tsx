"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getWorkspaceTopbarViewModel } from "@/lib/navigation";

export function AppTopbar() {
  const pathname = usePathname();
  const viewModel = getWorkspaceTopbarViewModel(pathname);

  return (
    <header className="app-topbar" aria-label={viewModel.assistantStatus}>
      <div className="topbar-breadcrumb" aria-label={viewModel.section}>
        <span>{viewModel.section}</span>
        <strong>{viewModel.title}</strong>
      </div>

      <div className="topbar-actions">
        <div className="topbar-status-chip" aria-label={viewModel.assistantStatus}>
          <span aria-hidden="true">AI</span>
          <strong>{viewModel.assistantStatus}</strong>
        </div>
        <label className="topbar-search" htmlFor="workspace-search">
          <span aria-hidden="true" />
          <input
            id="workspace-search"
            type="search"
            placeholder="Search in dashboard"
            readOnly
          />
        </label>
        <Link className="button topbar-action-button" href={viewModel.actionHref}>
          {viewModel.actionLabel}
        </Link>
        <div className="topbar-profile" aria-label="Current learner">
          <span aria-hidden="true">AC</span>
          <strong>Active learner</strong>
        </div>
      </div>
    </header>
  );
}
