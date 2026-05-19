import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Welcome back.</h1>
        <p>Signed in as {user.email}</p>
      </section>

      <section className="grid grid-3" aria-label="Dashboard sections">
        <article className="card">
          <h2>Account</h2>
          <p>{user.email}</p>
        </article>
        <article className="card">
          <h2>Quiz practice</h2>
          <p>Quiz attempts and practice status will appear here later.</p>
        </article>
        <article className="card">
          <h2>Study progress</h2>
          <p>Learning progress summaries will be added in a future feature.</p>
        </article>
      </section>

      <form className="button-row" action="/api/auth" method="post">
        <button
          className="button secondary"
          name="auth_action"
          value="logout"
          type="submit"
        >
          Logout
        </button>
      </form>
    </main>
  );
}
