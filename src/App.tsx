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
      <div className="app-shell">
        <div className="card skeleton-wrap" style={{ marginTop: "2rem" }}>
          <div className="skeleton" style={{ width: "45%" }} />
          <div className="skeleton" style={{ width: "100%" }} />
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
          <span className="topbar-user" title={user.login}>
            {user.login}
          </span>
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
