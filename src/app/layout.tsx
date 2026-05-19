import type { Metadata } from "next";
import Link from "next/link";
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
          <header className="top-nav">
            <nav className="top-nav-inner" aria-label="Main navigation">
              <Link className="brand" href="/">
                AI Study Assistant
              </Link>
              <div className="nav-links">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/documents">Documents</Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
