import Ferrofluid from "@/components/ferrofluid";

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
      <div className="login-ferrofluid-backdrop" aria-hidden="true">
        <Ferrofluid
          colors={["#ffffff", "#f5f5f5", "#d4d4d4"]}
          flowDirection="down"
          glow={1.6}
          mouseInteraction={true}
          mouseRadius={0.35}
          mouseStrength={0.8}
          opacity={0.42}
          scale={1.6}
          speed={0.35}
          turbulence={0.85}
        />
      </div>
      <div className="login-panel">
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
