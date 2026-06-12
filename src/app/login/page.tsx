type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="page auth-page login-page">
      <div className="login-panel">
        <section className="page-header login-intro login-brand-panel">
          <div>
            <p className="eyebrow">AI Study Assistant</p>
            <h1>Sign in to continue studying.</h1>
            <p>
              Return to your documents, grounded study chats, saved quizzes, and
              review notes from one learning workspace.
            </p>
          </div>
          <div className="login-helper-list" aria-label="Workspace highlights">
            <p>Document-aware answers</p>
            <p>Saved quizzes and notes</p>
            <p>Review center continuity</p>
          </div>
        </section>

        <form className="auth-form login-card" action="/api/auth" method="post">
          <div className="login-card-heading">
            <h2>Welcome back</h2>
            <p>Use your email and password to access the protected dashboard.</p>
          </div>

          <label className="form-field" htmlFor="email">
            <span>Email</span>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </label>

          <label className="form-field" htmlFor="password">
            <span>Password</span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {params.error ? <p className="form-message error">{params.error}</p> : null}
          {params.message ? <p className="form-message">{params.message}</p> : null}

          <div className="button-row">
            <button className="button" name="auth_action" value="login" type="submit">
              Login
            </button>
            <button
              className="button secondary"
              name="auth_action"
              value="signup"
              type="submit"
            >
              Register
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
