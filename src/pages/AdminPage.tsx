import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Account, AccountStatus, Bank, Platform, UserListItem, UserRole } from "../types";
import { STATUS_LABELS, STATUS_ORDER } from "../types";
import { ACCOUNT_COMMENT_MAX_LEN } from "../../shared/accountLimits";
import {
  formatSqliteUtcAsRuDateTimeUtc7,
  formatYmdRuCalendarUtc7,
} from "../lib/displayUtc7";
import {
  canonicalBalanceArs,
  formatBalanceArsDash,
  stripBalanceToDigits,
} from "../lib/balanceArs";

function dash(s: string | null | undefined) {
  const t = (s ?? "").trim();
  return t.length ? t : "—";
}

function blurSelect(el: HTMLSelectElement) {
  queueMicrotask(() => el.blur());
}

const roleLabel: Record<UserRole, string> = {
  admin: "Админ",
  user: "Пользователь",
};

type AdminTab = "users" | "platforms" | "accounts";

const TAB_LABELS: Record<AdminTab, string> = {
  users: "Пользователи",
  platforms: "Площадки",
  accounts: "ЛК",
};

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("accounts");

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [newUserLogin, setNewUserLogin] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [newPlatformName, setNewPlatformName] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [accStatus, setAccStatus] = useState<AccountStatus>("working");
  const [fullName, setFullName] = useState("");
  const [bankId, setBankId] = useState("");
  const [comment, setComment] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AccountStatus>("working");
  const [editFullName, setEditFullName] = useState("");
  const [editBankId, setEditBankId] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editTransferLimitUntil, setEditTransferLimitUntil] = useState("");
  const [editCoolingUntil, setEditCoolingUntil] = useState("");
  const [editModalErr, setEditModalErr] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const list = await api.listUsers();
    setUsers(list);
  }, []);

  const loadBanks = useCallback(async () => {
    const list = await api.banks();
    setBanks(list);
  }, []);

  const loadPlatforms = useCallback(async () => {
    const list = await api.platforms();
    setPlatforms(list);
    setPlatformId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadUsers();
        await loadPlatforms();
        await loadBanks();
      } catch (e) {
        if (!cancelled)
          setPageError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUsers, loadPlatforms, loadBanks]);

  useEffect(() => {
    if (!platformId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.accounts(platformId, "all");
        if (!cancelled) setAccounts(list);
      } catch (e) {
        if (!cancelled)
          setPageError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformId]);

  async function onAddUser(e: FormEvent) {
    e.preventDefault();
    if (!newUserLogin.trim() || !newUserPassword) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.createUser({
        login: newUserLogin.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      setNewUserLogin("");
      setNewUserPassword("");
      setNewUserRole("user");
      await loadUsers();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteUser(id: string) {
    if (!confirm("Удалить пользователя?")) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onAddPlatform(e: FormEvent) {
    e.preventDefault();
    if (!newPlatformName.trim()) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.createPlatform(newPlatformName.trim());
      setNewPlatformName("");
      await loadPlatforms();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeletePlatform(id: string) {
    if (!confirm("Удалить площадку и все ЛК?")) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.deletePlatform(id);
      await loadPlatforms();
      if (platformId === id) setAccounts([]);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onAddBank(e: FormEvent) {
    e.preventDefault();
    if (!newBankName.trim()) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.createBank(newBankName.trim());
      setNewBankName("");
      await loadBanks();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteBank(id: string) {
    if (!confirm("Удалить банк?")) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.deleteBank(id);
      await loadBanks();
      if (platformId) {
        const list = await api.accounts(platformId, "all");
        setAccounts(list);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onAddAccount(e: FormEvent) {
    e.preventDefault();
    if (!platformId) return;
    if (comment.length > ACCOUNT_COMMENT_MAX_LEN) {
      setPageError(`Комментарий не длиннее ${ACCOUNT_COMMENT_MAX_LEN} символов`);
      return;
    }
    setPageError(null);
    setBusy(true);
    try {
      await api.createAccount({
        platformId,
        status: accStatus,
        fullName,
        ...(bankId ? { bankId } : {}),
        comment,
        balance: canonicalBalanceArs(balance),
      });
      setFullName("");
      setBankId("");
      setComment("");
      setBalance("");
      const list = await api.accounts(platformId, "all");
      setAccounts(list);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAccount(id: string) {
    if (!confirm("Удалить ЛК?")) return;
    setPageError(null);
    setBusy(true);
    try {
      await api.deleteAccount(id);
      if (editAccountId === id) setEditAccountId(null);
      if (platformId) {
        const list = await api.accounts(platformId, "all");
        setAccounts(list);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function openAccountEdit(a: Account) {
    setEditAccountId(a.id);
    setEditStatus(a.status);
    setEditFullName(a.full_name);
    setEditBankId(a.bank_id ?? "");
    setEditBalance(stripBalanceToDigits(a.balance));
    setEditComment(a.comment);
    setEditTransferLimitUntil((a.transfer_limit_until ?? "").trim());
    setEditCoolingUntil((a.cooling_until ?? "").trim());
    setEditModalErr(null);
  }

  function closeAccountEdit() {
    if (busy) return;
    setEditAccountId(null);
    setEditModalErr(null);
  }

  async function onSaveEditAccount(e: FormEvent) {
    e.preventDefault();
    if (!editAccountId || !platformId) return;
    if (editComment.length > ACCOUNT_COMMENT_MAX_LEN) {
      setEditModalErr(`Комментарий не длиннее ${ACCOUNT_COMMENT_MAX_LEN} символов`);
      return;
    }
    if (editStatus === "needs_repair" && !editComment.trim()) {
      setEditModalErr("Для «Нужна починка» укажите комментарий");
      return;
    }
    if (editStatus === "transfer_limits") {
      const t = editTransferLimitUntil.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        setEditModalErr("Укажите дату окончания лимита (ГГГГ-ММ-ДД)");
        return;
      }
    }
    if (editStatus === "cooling") {
      const t = editCoolingUntil.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        setEditModalErr("Укажите дату окончания отлеги (ГГГГ-ММ-ДД)");
        return;
      }
    }
    setEditModalErr(null);
    setPageError(null);
    setBusy(true);
    try {
      await api.updateAccount(editAccountId, {
        status: editStatus,
        fullName: editFullName,
        bankId: editBankId.trim() ? editBankId.trim() : null,
        balance: canonicalBalanceArs(editBalance),
        comment: editComment,
        transferLimitUntil:
          editStatus === "transfer_limits"
            ? editTransferLimitUntil.trim() || null
            : null,
        coolingUntil:
          editStatus === "cooling" ? editCoolingUntil.trim() || null : null,
      });
      const list = await api.accounts(platformId, "all");
      setAccounts(list);
      setEditAccountId(null);
    } catch (err) {
      setEditModalErr(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const tabs: AdminTab[] = ["accounts", "platforms", "users"];

  return (
    <>
    <main className="admin-shell">
      {pageError && (
        <div className="alert alert-error admin-alert" role="alert">
          {pageError}
        </div>
      )}

      <div className="admin-tabs-wrap">
        <div className="admin-tabs" role="tablist" aria-label="Админ">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              id={`admin-tab-${id}`}
              className={`admin-tab ${tab === id ? "admin-tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <span className="admin-tab-label">{TAB_LABELS[id]}</span>
              <span className="admin-tab-count">
                {id === "users"
                  ? users.length
                  : id === "platforms"
                    ? platforms.length + banks.length
                    : platforms.length > 0
                      ? accounts.length
                      : "—"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <section
        className="admin-workspace"
        role="tabpanel"
        aria-labelledby={`admin-tab-${tab}`}
      >
        {tab === "users" && (
          <>
            <section className="admin-section">
              <h2 className="admin-section-title">Создать пользователя</h2>
              <form onSubmit={onAddUser} className="row cols-2 admin-form-grid">
                <div className="field">
                  <label htmlFor="nu-login">Логин</label>
                  <input
                    id="nu-login"
                    value={newUserLogin}
                    onChange={(e) => setNewUserLogin(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="nu-pass">Пароль</label>
                  <input
                    id="nu-pass"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label htmlFor="nu-role">Роль</label>
                  <select
                    id="nu-role"
                    value={newUserRole}
                    onChange={(e) => {
                      setNewUserRole(e.target.value as UserRole);
                      blurSelect(e.currentTarget);
                    }}
                  >
                    <option value="user">Пользователь</option>
                    <option value="admin">Админ</option>
                  </select>
                </div>
                <div className="field field-push-btn">
                  <label className="field-spacer-label" aria-hidden="true">
                    {"\u00A0"}
                  </label>
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                    Создать
                  </button>
                </div>
              </form>
            </section>

            <section className="admin-section">
              <h2 className="admin-section-title">Пользователи</h2>
              {users.length === 0 ? (
                <p className="empty admin-empty">Нет записей.</p>
              ) : (
                <div className="table-wrap admin-table-wrap">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Логин</th>
                        <th>Роль</th>
                        <th>Создан</th>
                        <th className="col-narrow" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.login}</td>
                          <td>
                            <span
                              className={`status-badge ${u.role === "admin" ? "role-badge-admin" : "role-badge-user"}`}
                            >
                              {roleLabel[u.role]}
                            </span>
                          </td>
                          <td className="cell-muted admin-date-utc7">
                            {formatSqliteUtcAsRuDateTimeUtc7(u.created_at)}
                          </td>
                          <td className="col-narrow">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void onDeleteUser(u.id)}
                              disabled={busy}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === "platforms" && (
          <>
            <section className="admin-section">
              <h2 className="admin-section-title">Площадки</h2>
              <form className="admin-inline-add-form" onSubmit={onAddPlatform}>
                <div className="field">
                  <label htmlFor="np">Название</label>
                  <input
                    id="np"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="admin-inline-add-form__submit">
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                    Добавить
                  </button>
                </div>
              </form>

              {platforms.length === 0 ? (
                <p className="empty admin-empty">Нет записей.</p>
              ) : (
                <ul className="platform-list admin-platform-list">
                  {platforms.map((p) => (
                    <li key={p.id} className="platform-row">
                      <span className="platform-name">{p.name}</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void onDeletePlatform(p.id)}
                        disabled={busy}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="admin-section">
              <h2 className="admin-section-title">Банки</h2>
              <form className="admin-inline-add-form" onSubmit={onAddBank}>
                <div className="field">
                  <label htmlFor="nb">Название</label>
                  <input
                    id="nb"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="admin-inline-add-form__submit">
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                    Добавить
                  </button>
                </div>
              </form>

              {banks.length === 0 ? (
                <p className="empty admin-empty">Нет записей.</p>
              ) : (
                <ul className="platform-list admin-platform-list">
                  {banks.map((b) => (
                    <li key={b.id} className="platform-row">
                      <span className="platform-name">{b.name}</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void onDeleteBank(b.id)}
                        disabled={busy}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === "accounts" && (
          <>
            {platforms.length === 0 ? (
              <p className="empty admin-empty">Нет площадок.</p>
            ) : (
              <>
                <section className="admin-section">
                  <h2 className="admin-section-title">Площадка</h2>
                  <div className="admin-toolbar">
                    <div className="field admin-toolbar__field">
                      <label htmlFor="adm-pl">Выбор площадки</label>
                      <select
                        id="adm-pl"
                        value={platformId}
                        onChange={(e) => {
                          setPlatformId(e.target.value);
                          blurSelect(e.currentTarget);
                        }}
                      >
                        {platforms.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="admin-stat-pill" aria-live="polite">
                      ЛК: <strong>{accounts.length}</strong>
                    </span>
                  </div>
                </section>

                <section className="admin-section">
                  <h2 className="admin-section-title">Новый ЛК</h2>
                  <form className="admin-form-stack" onSubmit={onAddAccount}>
                    <div className="row cols-2 admin-form-grid">
                      <div className="field">
                        <label htmlFor="acc-status">Статус</label>
                        <select
                          id="acc-status"
                          value={accStatus}
                          onChange={(e) => {
                            setAccStatus(e.target.value as AccountStatus);
                            blurSelect(e.currentTarget);
                          }}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="acc-fio">ФИО</label>
                        <input
                          id="acc-fio"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="acc-bank">Банк</label>
                        <select
                          id="acc-bank"
                          value={bankId}
                          onChange={(e) => {
                            setBankId(e.target.value);
                            blurSelect(e.currentTarget);
                          }}
                        >
                          <option value="">—</option>
                          {banks.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="acc-balance">Баланс</label>
                        <input
                          id="acc-balance"
                          value={balance}
                          onChange={(e) => setBalance(stripBalanceToDigits(e.target.value))}
                          inputMode="numeric"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="acc-comment">Комментарий</label>
                      <textarea
                        id="acc-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        maxLength={ACCOUNT_COMMENT_MAX_LEN}
                        rows={2}
                        className="admin-textarea-compact"
                      />
                    </div>
                    <div className="form-actions admin-form-actions">
                      <button className="btn btn-primary" type="submit" disabled={busy}>
                        Добавить
                      </button>
                    </div>
                  </form>
                </section>

                <section className="admin-section">
                  <h2 className="admin-section-title">Список</h2>
                  {accounts.length === 0 ? (
                    <p className="empty admin-empty">Нет записей.</p>
                  ) : (
                    <div className="table-wrap admin-table-wrap">
                      <table className="admin-data-table admin-accounts-table">
                        <thead>
                          <tr>
                            <th>Статус</th>
                            <th>ФИО</th>
                            <th>Банк</th>
                            <th>Баланс</th>
                            <th>Коммент.</th>
                            <th className="col-narrow" />
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <span className={`status-badge status-${a.status}`}>
                                  {STATUS_LABELS[a.status]}
                                </span>
                                {a.status === "transfer_limits" && a.transfer_limit_until && (
                                  <div className="admin-status-date">
                                    лимит до {formatYmdRuCalendarUtc7(a.transfer_limit_until)}
                                  </div>
                                )}
                                {a.status === "cooling" && a.cooling_until && (
                                  <div className="admin-status-date">
                                    отлега до {formatYmdRuCalendarUtc7(a.cooling_until)}
                                  </div>
                                )}
                              </td>
                              <td>{dash(a.full_name)}</td>
                              <td className="cell-muted">{dash(a.bank_name)}</td>
                              <td className="mono admin-accounts-balance">
                                {formatBalanceArsDash(a.balance)}
                              </td>
                              <td className="cell-comment admin-accounts-comment">{dash(a.comment)}</td>
                              <td className="col-narrow admin-accounts-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openAccountEdit(a)}
                                  disabled={busy}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => void onDeleteAccount(a.id)}
                                  disabled={busy}
                                >
                                  Удалить
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>

      {editAccountId && (
        <div className="status-modal-root" role="presentation">
          <div
            className="status-modal-backdrop"
            role="presentation"
            onClick={closeAccountEdit}
          />
          <div
            className="status-modal-panel admin-account-edit-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-acc-title"
          >
            <h3 id="admin-edit-acc-title" className="status-modal-title">
              Изменить ЛК
            </h3>
            <form
              className="admin-account-edit-form"
              onSubmit={(e) => void onSaveEditAccount(e)}
            >
              <div className="row cols-2 admin-form-grid">
                <div className="field">
                  <label htmlFor="edit-acc-status">Статус</label>
                  <select
                    id="edit-acc-status"
                    value={editStatus}
                    onChange={(e) => {
                      setEditStatus(e.target.value as AccountStatus);
                      blurSelect(e.currentTarget);
                    }}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                {editStatus === "transfer_limits" && (
                  <div className="field">
                    <label htmlFor="edit-acc-tl">Лимит до</label>
                    <input
                      id="edit-acc-tl"
                      type="date"
                      value={editTransferLimitUntil}
                      onChange={(e) => setEditTransferLimitUntil(e.target.value)}
                    />
                  </div>
                )}
                {editStatus === "cooling" && (
                  <div className="field">
                    <label htmlFor="edit-acc-cl">Отлега до</label>
                    <input
                      id="edit-acc-cl"
                      type="date"
                      value={editCoolingUntil}
                      onChange={(e) => setEditCoolingUntil(e.target.value)}
                    />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="edit-acc-fio">ФИО</label>
                  <input
                    id="edit-acc-fio"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-acc-bank">Банк</label>
                  <select
                    id="edit-acc-bank"
                    value={editBankId}
                    onChange={(e) => {
                      setEditBankId(e.target.value);
                      blurSelect(e.currentTarget);
                    }}
                  >
                    <option value="">—</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="edit-acc-balance">Баланс</label>
                  <input
                    id="edit-acc-balance"
                    value={editBalance}
                    onChange={(e) =>
                      setEditBalance(stripBalanceToDigits(e.target.value))
                    }
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="field admin-account-edit-form__comment">
                <label htmlFor="edit-acc-comment">Комментарий</label>
                <textarea
                  id="edit-acc-comment"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  maxLength={ACCOUNT_COMMENT_MAX_LEN}
                  rows={2}
                  className="admin-textarea-compact"
                />
              </div>
              {editModalErr && <p className="status-modal-err admin-modal-err">{editModalErr}</p>}
              <div className="status-modal-actions admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost status-modal-cancel"
                  onClick={closeAccountEdit}
                  disabled={busy}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
