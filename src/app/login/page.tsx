type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="page auth-page">
      <section className="page-header">
        <p className="eyebrow">Account</p>
        <h1>Sign in to continue studying.</h1>
        <p>Use your email and password to access the protected dashboard.</p>
      </section>

      <form className="auth-form" action="/api/auth" method="post">
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
    </main>
  );
}
