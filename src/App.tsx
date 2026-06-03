import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import { RequireAdmin } from "./routes/RequireAdmin";
import { UserPage } from "./pages/UserPage";

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="app-shell app-loading">
        <div className="app-loading-card">
          <div className="app-loading-logo" aria-hidden>
            LK
          </div>
          <p className="app-loading-text">Загрузка…</p>
          <div className="skeleton-wrap">
            <div className="skeleton" style={{ width: "70%" }} />
            <div className="skeleton" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Статистика</span>
          <span className="brand-tag">by El Pollo</span>
        </div>
        <nav className="nav-links">
          <div className="topbar-user-wrap" title={user.login}>
            <span className="topbar-user-badge" aria-hidden>
              {user.login.charAt(0).toUpperCase()}
            </span>
            <span className="topbar-user">{user.login}</span>
          </div>
          {user.role === "admin" && (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive ? "nav-item nav-item-active" : "nav-item"
                }
              >
                Просмотр
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  isActive ? "nav-item nav-item-active" : "nav-item"
                }
              >
                Админ
              </NavLink>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void logout()}
          >
            Выйти
          </button>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<UserPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
