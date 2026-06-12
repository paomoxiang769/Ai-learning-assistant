import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Study Assistant",
  description: "A study workspace for documents, quizzes, and learning progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppSidebar />
          <div className="app-main">
            <AppTopbar />
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
