import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [loginStr, setLoginStr] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(loginStr.trim(), password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <header className="auth-panel-head">
          <div className="auth-icon-wrap" aria-hidden>
            <svg
              className="auth-icon"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="auth-product">Статистика · by El Pollo</p>
          <h1 id="auth-heading" className="auth-panel-title">
            Вход в систему
          </h1>
        </header>

        {error && (
          <div className="alert alert-error auth-alert" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field-block">
            <label htmlFor="auth-login">Логин</label>
            <input
              id="auth-login"
              type="text"
              autoComplete="username"
              value={loginStr}
              onChange={(e) => setLoginStr(e.target.value)}
              placeholder="Логин учётной записи"
            />
          </div>
          <div className="field-block">
            <label htmlFor="auth-password">Пароль</label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
            />
          </div>
          <button
            className="btn btn-primary btn-block auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Вход…" : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}
