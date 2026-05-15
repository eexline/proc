import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import type { Account, AccountStatus, Platform } from "../types";
import { STATUS_LABELS, STATUS_ORDER } from "../types";
import { ACCOUNT_COMMENT_MAX_LEN } from "../../shared/accountLimits";
import {
  formatSqliteUtcAsRuDateTimeAuditStrip,
  formatYmdRuCalendarUtc7,
} from "../lib/displayUtc7";
import {
  balancesArsEqual,
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

function FieldEditCaption({
  account,
  field,
}: {
  account: Account;
  field: "status" | "balance" | "comment";
}) {
  const at =
    field === "status"
      ? account.status_updated_at
      : field === "balance"
        ? account.balance_updated_at
        : account.comment_updated_at;
  const byLogin =
    field === "status"
      ? account.status_updated_by_login
      : field === "balance"
        ? account.balance_updated_by_login
        : account.comment_updated_by_login;
  if (!at) {
    return (
      <div className="lk-field-audit lk-field-audit--empty" aria-label="Правок не было">
        <span className="lk-field-audit__empty">—</span>
      </div>
    );
  }
  return (
    <div
      className="lk-field-audit lk-field-audit--has-stamp"
      aria-label={`${dash(byLogin)}, ${formatSqliteUtcAsRuDateTimeAuditStrip(at)}`}
    >
      <div className="lk-field-audit__login">{dash(byLogin)}</div>
      <div className="lk-field-audit__time mono">{formatSqliteUtcAsRuDateTimeAuditStrip(at)}</div>
    </div>
  );
}

function CaptionGhost() {
  return (
    <div
      className="lk-caption-slot lk-caption-slot--ghost lk-audit-placeholder"
      aria-hidden="true"
    />
  );
}

function StatusNeonIcon() {
  return (
    <svg className="status-neon-svg" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

type StatusApplyPayload = {
  status: AccountStatus;
  transferLimitUntil: string | null;
  coolingUntil: string | null;
  comment: string;
};

function StatusPickerModal({
  open,
  currentStatus,
  transferLimitUntil,
  coolingUntil,
  comment: rowComment,
  onClose,
  onApply,
}: {
  open: boolean;
  currentStatus: AccountStatus;
  transferLimitUntil: string;
  coolingUntil: string;
  comment: string;
  onClose: () => void;
  onApply: (p: StatusApplyPayload) => Promise<boolean>;
}) {
  const titleId = useId();
  type Screen = "list" | "extra";
  const [screen, setScreen] = useState<Screen>("list");
  const [chosen, setChosen] = useState<AccountStatus | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [coolDraft, setCoolDraft] = useState("");
  const [repairDraft, setRepairDraft] = useState("");
  const [modalErr, setModalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScreen("list");
    setChosen(null);
    setModalErr(null);
    setLimitDraft(transferLimitUntil.trim());
    setCoolDraft(coolingUntil.trim());
    setRepairDraft(rowComment);
  }, [open, transferLimitUntil, coolingUntil, rowComment]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (screen === "extra") {
        setScreen("list");
        setChosen(null);
        setModalErr(null);
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, screen]);

  if (!open) return null;

  async function pickSimple(s: AccountStatus) {
    const ok = await onApply({
      status: s,
      transferLimitUntil: null,
      coolingUntil: null,
      comment: rowComment,
    });
    if (ok) onClose();
  }

  function openExtra(s: AccountStatus) {
    setChosen(s);
    setScreen("extra");
    setModalErr(null);
    if (s === "transfer_limits") setLimitDraft(transferLimitUntil.trim());
    if (s === "cooling") setCoolDraft(coolingUntil.trim());
    if (s === "needs_repair") setRepairDraft(rowComment);
  }

  async function confirmExtra() {
    if (!chosen) return;
    setModalErr(null);
    if (chosen === "transfer_limits") {
      const d = limitDraft.trim();
      if (!d) {
        setModalErr("Укажите дату окончания лимита");
        return;
      }
      const ok = await onApply({
        status: "transfer_limits",
        transferLimitUntil: d,
        coolingUntil: null,
        comment: rowComment,
      });
      if (ok) onClose();
      return;
    }
    if (chosen === "cooling") {
      const d = coolDraft.trim();
      if (!d) {
        setModalErr("Укажите дату окончания отлеги");
        return;
      }
      const ok = await onApply({
        status: "cooling",
        transferLimitUntil: null,
        coolingUntil: d,
        comment: rowComment,
      });
      if (ok) onClose();
      return;
    }
    if (chosen === "needs_repair") {
      const c = repairDraft.trim();
      if (!c) {
        setModalErr("Опишите, что нужно починить");
        return;
      }
      if (c.length > ACCOUNT_COMMENT_MAX_LEN) {
        setModalErr(`Комментарий не длиннее ${ACCOUNT_COMMENT_MAX_LEN} символов`);
        return;
      }
      const ok = await onApply({
        status: "needs_repair",
        transferLimitUntil: null,
        coolingUntil: null,
        comment: c,
      });
      if (ok) onClose();
    }
  }

  return createPortal(
    <div className="status-modal-root" role="presentation">
      <div className="status-modal-backdrop" role="presentation" onClick={onClose} />
      <div
        className="status-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {screen === "list" ? (
          <>
            <h3 id={titleId} className="status-modal-title">
              Статус личного кабинета
            </h3>
            <p className="status-modal-hint">Выберите новое значение</p>
            <ul className="status-modal-list">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className={`status-modal-option status-modal-option--${s}${s === currentStatus ? " status-modal-option--current" : ""}`}
                    onClick={() => {
                      if (s === "working" || s === "blocked") void pickSimple(s);
                      else openExtra(s);
                    }}
                  >
                    <span className="status-modal-option-dot" />
                    <span>{STATUS_LABELS[s]}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-ghost btn-block status-modal-cancel"
              onClick={onClose}
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="status-modal-backlink"
              onClick={() => {
                setScreen("list");
                setChosen(null);
                setModalErr(null);
              }}
            >
              ← К списку статусов
            </button>
            <h3 id={titleId} className="status-modal-title">
              {chosen ? STATUS_LABELS[chosen] : ""}
            </h3>
            {chosen === "transfer_limits" && (
              <div className="status-modal-field">
                <label htmlFor="lim-until">Лимиты действуют до</label>
                <input
                  id="lim-until"
                  type="date"
                  className="table-inline-control"
                  value={limitDraft}
                  onChange={(e) => setLimitDraft(e.target.value)}
                />
              </div>
            )}
            {chosen === "cooling" && (
              <div className="status-modal-field">
                <label htmlFor="cool-until">Отлега до</label>
                <input
                  id="cool-until"
                  type="date"
                  className="table-inline-control"
                  value={coolDraft}
                  onChange={(e) => setCoolDraft(e.target.value)}
                />
              </div>
            )}
            {chosen === "needs_repair" && (
              <div className="status-modal-field">
                <label htmlFor="repair-c">Комментарий (что починить, до {ACCOUNT_COMMENT_MAX_LEN} симв.)</label>
                <textarea
                  id="repair-c"
                  className="table-inline-control status-modal-textarea"
                  value={repairDraft}
                  onChange={(e) => setRepairDraft(e.target.value)}
                  placeholder="Опишите проблему"
                  rows={3}
                  maxLength={ACCOUNT_COMMENT_MAX_LEN}
                />
              </div>
            )}
            {modalErr && <p className="status-modal-err">{modalErr}</p>}
            <div className="status-modal-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={() => void confirmExtra()}>
                Применить
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setScreen("list");
                  setChosen(null);
                  setModalErr(null);
                }}
              >
                Назад
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function AccountEditRow({
  account,
  onApplied,
  showPlatformColumn,
  onClipboardCopy,
}: {
  account: Account;
  onApplied: () => void | Promise<void>;
  showPlatformColumn: boolean;
  onClipboardCopy: (text: string) => void;
}) {
  const [status, setStatus] = useState(account.status);
  const [balance, setBalance] = useState(() => stripBalanceToDigits(account.balance));
  const [comment, setComment] = useState(
    account.comment.slice(0, ACCOUNT_COMMENT_MAX_LEN)
  );
  const [transferLimitUntil, setTransferLimitUntil] = useState(
    (account.transfer_limit_until ?? "").trim()
  );
  const [coolingUntil, setCoolingUntil] = useState((account.cooling_until ?? "").trim());
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [balanceEditOpen, setBalanceEditOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef(account);
  const valuesRef = useRef({
    status,
    balance,
    comment,
    transferLimitUntil,
    coolingUntil,
  });

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    valuesRef.current = {
      status,
      balance,
      comment,
      transferLimitUntil,
      coolingUntil,
    };
  }, [status, balance, comment, transferLimitUntil, coolingUntil]);

  async function copyFioToClipboard() {
    const text = accountRef.current.full_name.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        return;
      }
    }
    onClipboardCopy(text);
  }

  useEffect(() => {
    setStatus(account.status);
    setBalance(stripBalanceToDigits(account.balance));
    setComment(account.comment.slice(0, ACCOUNT_COMMENT_MAX_LEN));
    setTransferLimitUntil((account.transfer_limit_until ?? "").trim());
    setCoolingUntil((account.cooling_until ?? "").trim());
    setLocalErr(null);
    setBalanceEditOpen(false);
    setStatusModalOpen(false);
  }, [account]);

  useEffect(() => {
    if (balanceEditOpen) {
      balanceInputRef.current?.focus();
      balanceInputRef.current?.select();
    }
  }, [balanceEditOpen]);

  const persistSnapshot = useCallback(
    async (
      prev: Account,
      next: {
        status: AccountStatus;
        balance: string;
        comment: string;
        transferLimitUntil: string | null;
        coolingUntil: string | null;
      }
    ): Promise<boolean> => {
      const pTl = (prev.transfer_limit_until ?? "").trim();
      const pCl = (prev.cooling_until ?? "").trim();
      const nTl = (next.transferLimitUntil ?? "").trim();
      const nCl = (next.coolingUntil ?? "").trim();
      if (
        next.status === prev.status &&
        balancesArsEqual(next.balance, prev.balance) &&
        next.comment === prev.comment &&
        nTl === pTl &&
        nCl === pCl
      ) {
        return true;
      }
      setLocalErr(null);
      setSaving(true);
      try {
        await api.updateAccount(accountRef.current.id, {
          status: next.status,
          balance: canonicalBalanceArs(next.balance),
          comment: next.comment,
          transferLimitUntil:
            next.status === "transfer_limits" ? (nTl || null) : null,
          coolingUntil: next.status === "cooling" ? (nCl || null) : null,
        });
        await onApplied();
        return true;
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : "Ошибка");
        setStatus(prev.status);
        setBalance(stripBalanceToDigits(prev.balance));
        setComment(prev.comment);
        setTransferLimitUntil(pTl);
        setCoolingUntil(pCl);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onApplied]
  );

  async function handleStatusApply(payload: StatusApplyPayload): Promise<boolean> {
    const prev = accountRef.current;
    const bal = valuesRef.current.balance;
    const next = {
      status: payload.status,
      balance: canonicalBalanceArs(bal),
      comment: payload.comment,
      transferLimitUntil:
        payload.status === "transfer_limits" ? payload.transferLimitUntil : null,
      coolingUntil: payload.status === "cooling" ? payload.coolingUntil : null,
    };
    return persistSnapshot(prev, next);
  }

  async function persistBalanceIfChanged() {
    const prev = accountRef.current;
    const v = valuesRef.current;
    if (balancesArsEqual(v.balance, prev.balance)) return;
    const next = {
      status: v.status,
      balance: canonicalBalanceArs(v.balance),
      comment: v.comment,
      transferLimitUntil:
        v.status === "transfer_limits" ? v.transferLimitUntil.trim() || null : null,
      coolingUntil: v.status === "cooling" ? v.coolingUntil.trim() || null : null,
    };
    await persistSnapshot(prev, next);
  }

  useEffect(() => {
    if (comment === account.comment) return;
    const t = window.setTimeout(() => {
      const prev = accountRef.current;
      const v = valuesRef.current;
      if (v.comment === prev.comment) return;
      const next = {
        status: v.status,
        balance: canonicalBalanceArs(v.balance),
        comment: v.comment,
        transferLimitUntil:
          v.status === "transfer_limits" ? v.transferLimitUntil.trim() || null : null,
        coolingUntil: v.status === "cooling" ? v.coolingUntil.trim() || null : null,
      };
      void persistSnapshot(prev, next);
    }, 480);
    return () => window.clearTimeout(t);
  }, [
    comment,
    account.comment,
    account.id,
    account.status,
    account.balance,
    account.transfer_limit_until,
    account.cooling_until,
    persistSnapshot,
  ]);

  return (
    <tr className="user-lk-row">
      <StatusPickerModal
        open={statusModalOpen}
        currentStatus={status}
        transferLimitUntil={transferLimitUntil}
        coolingUntil={coolingUntil}
        comment={comment}
        onClose={() => setStatusModalOpen(false)}
        onApply={handleStatusApply}
      />
      <td className="cell-editable user-lk-td">
        <div className="lk-td-stack lk-td-stack--with-audit">
          <div className="lk-td-main">
            <button
              type="button"
              className={`status-neon-trigger status-neon-trigger--${status}`}
              onClick={() => setStatusModalOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={statusModalOpen}
              title="Сменить статус"
              disabled={saving}
            >
              <span className="status-neon-icon-wrap">
                <StatusNeonIcon />
              </span>
              <span className="status-neon-label">{STATUS_LABELS[status]}</span>
            </button>
            {status === "transfer_limits" && transferLimitUntil.trim() && (
              <div className="user-lk-status-meta">
                лимит до {formatYmdRuCalendarUtc7(transferLimitUntil.trim())}
              </div>
            )}
            {status === "cooling" && coolingUntil.trim() && (
              <div className="user-lk-status-meta">
                отлега до {formatYmdRuCalendarUtc7(coolingUntil.trim())}
              </div>
            )}
            {saving && <div className="user-lk-saving">Сохранение…</div>}
            {localErr && <div className="user-lk-inline-error">{localErr}</div>}
          </div>
          <div className="lk-caption-slot">
            <FieldEditCaption account={account} field="status" />
          </div>
        </div>
      </td>
      {showPlatformColumn && (
        <td className="cell-muted user-lk-td user-lk-td-platform">
          <div className="lk-td-stack lk-td-stack--with-audit">
            <div className="lk-td-main lk-td-main--plain">{dash(account.platform_name)}</div>
            <CaptionGhost />
          </div>
        </td>
      )}
      <td className="user-lk-td">
        <div className="lk-td-stack lk-td-stack--with-audit">
          <div className="lk-td-main">
            <button
              type="button"
              className="lk-td-main--plain user-lk-fio-copy"
              onClick={() => void copyFioToClipboard()}
              title="Скопировать ФИО в буфер обмена"
            >
              {dash(account.full_name)}
            </button>
          </div>
          <CaptionGhost />
        </div>
      </td>
      <td className="cell-muted user-lk-td">
        <div className="lk-td-stack lk-td-stack--with-audit">
          <div className="lk-td-main lk-td-main--plain">{dash(account.bank_name)}</div>
          <CaptionGhost />
        </div>
      </td>
      <td className="cell-editable user-lk-td">
        <div className="lk-td-stack lk-td-stack--with-audit">
          <div className="lk-td-main">
            {balanceEditOpen ? (
              <input
                ref={balanceInputRef}
                className="table-inline-control mono"
                value={balance}
                onChange={(e) => setBalance(stripBalanceToDigits(e.target.value))}
                placeholder="ARS, цифры"
                aria-label="Баланс в песо ARS, целое число без копеек"
                disabled={saving}
                onBlur={() => {
                  setBalanceEditOpen(false);
                  void persistBalanceIfChanged();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setBalance(stripBalanceToDigits(accountRef.current.balance));
                    setBalanceEditOpen(false);
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    balanceInputRef.current?.blur();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="balance-plain"
                onClick={() => setBalanceEditOpen(true)}
                title="Нажмите, чтобы изменить (ARS, без копеек)"
                disabled={saving}
              >
                {formatBalanceArsDash(balance)}
              </button>
            )}
          </div>
          <div className="lk-caption-slot">
            <FieldEditCaption account={account} field="balance" />
          </div>
        </div>
      </td>
      <td className="cell-editable cell-comment user-lk-td user-lk-comment-cell">
        <div className="lk-td-stack lk-td-stack--with-audit">
          <div className="lk-td-main">
            <textarea
              className="table-inline-control user-lk-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий"
              rows={2}
              maxLength={ACCOUNT_COMMENT_MAX_LEN}
              disabled={saving}
            />
          </div>
          <div className="lk-caption-slot">
            <FieldEditCaption account={account} field="comment" />
          </div>
        </div>
      </td>
    </tr>
  );
}
export function UserPage() {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformId, setPlatformId] = useState<string>("");
  const [filter, setFilter] = useState<AccountStatus | "all">("all");
  const [fioSearch, setFioSearch] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clipboardToast, setClipboardToast] = useState<string | null>(null);
  const clipboardToastHideRef = useRef(0);

  const showClipboardToast = useCallback((value: string) => {
    window.clearTimeout(clipboardToastHideRef.current);
    setClipboardToast(value);
    clipboardToastHideRef.current = window.setTimeout(() => {
      setClipboardToast(null);
    }, 3800);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(clipboardToastHideRef.current);
  }, []);

  const loadPlatforms = useCallback(async () => {
    setError(null);
    const list = await api.platforms();
    setPlatforms(list);
    setPlatformId((prev) => {
      if (prev === "all" && list.length > 0) return "all";
      if (prev && prev !== "all" && list.some((p) => p.id === prev)) return prev;
      if (list.length > 0) return "all";
      return "";
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadPlatforms();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlatforms]);

  useEffect(() => {
    if (!platformId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.accounts(platformId, filter);
        if (!cancelled) setAccounts(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformId, filter]);

  const currentPlatform =
    platformId === "all" ? undefined : platforms.find((p) => p.id === platformId);

  const reloadAccounts = useCallback(async () => {
    if (!platformId) return;
    try {
      const list = await api.accounts(platformId, filter);
      setAccounts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, [platformId, filter]);

  const filteredAccounts = useMemo(() => {
    const q = fioSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => (a.full_name ?? "").toLowerCase().includes(q));
  }, [accounts, fioSearch]);

  return (
    <>
      <main>
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="card skeleton-wrap" aria-busy="true" aria-label="Загрузка">
          <div className="skeleton" style={{ width: "55%" }} />
          <div className="skeleton" style={{ width: "100%" }} />
          <div className="skeleton" style={{ width: "88%" }} />
        </div>
      ) : platforms.length === 0 ? (
        <div className="card empty empty-card">
          Площадок пока нет.
          {user?.role === "admin" ? (
            <>
              {" "}
              Добавьте их в разделе{" "}
              <Link to="/admin">Админ</Link>.
            </>
          ) : (
            <> Обратитесь к администратору.</>
          )}
        </div>
      ) : (
        <>
          <div className="card user-lk-filters-card">
            <div className="card-header user-lk-filters-card__head">
              <div>
                <p className="card-title">Фильтры</p>
                <h2 className="card-heading">Площадка и статус</h2>
              </div>
              {(platformId === "all" || currentPlatform) && (
                <span className="stat-chip user-lk-filters-card__chip">
                  Сейчас:{" "}
                  <span className="user-lk-filters-card__current-name">
                    {platformId === "all" ? "Все площадки" : currentPlatform?.name}
                  </span>
                </span>
              )}
            </div>
            <div className="toolbar user-lk-filters-toolbar">
              <div className="field">
                <label htmlFor="pl">Площадка</label>
                <select
                  id="pl"
                  value={platformId}
                  onChange={(e) => {
                    setPlatformId(e.target.value);
                    blurSelect(e.currentTarget);
                  }}
                >
                  <option value="all">Все площадки</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="st">Статус ЛК</label>
                <select
                  id="st"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as AccountStatus | "all");
                    blurSelect(e.currentTarget);
                  }}
                >
                  <option value="all">Все ЛК</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field user-lk-filters-toolbar__fio">
                <label htmlFor="lk-fio-search">Поиск по ФИО</label>
                <input
                  id="lk-fio-search"
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Фамилия, имя…"
                  aria-label="Поиск по ФИО в списке"
                  value={fioSearch}
                  onChange={(e) => setFioSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <p className="card-title">Таблица</p>
                <h2 className="card-heading">Список личных кабинетов</h2>
              </div>
              <span className="stat-chip">
                {fioSearch.trim() ? (
                  <>
                    Показано: <strong>{filteredAccounts.length}</strong> из {accounts.length}
                  </>
                ) : (
                  <>
                    Записей: <strong>{accounts.length}</strong>
                  </>
                )}
              </span>
            </div>

            {accounts.length === 0 ? (
              <p className="empty" style={{ paddingTop: "0.5rem" }}>
                Нет записей по выбранному фильтру.
              </p>
            ) : filteredAccounts.length === 0 ? (
              <p className="empty" style={{ paddingTop: "0.5rem" }}>
                Нет записей, подходящих под поиск по ФИО.
              </p>
            ) : (
              <div className="table-wrap">
<table
                  className={
                    platformId === "all"
                      ? "user-lk-table user-lk-table--all-platforms"
                      : "user-lk-table user-lk-table--one-platform"
                  }
                >
                  <thead>
                    <tr>
                      <th>Статус</th>
                      {platformId === "all" && <th>Площадка</th>}
                      <th>ФИО</th>
                      <th>Банк</th>
                      <th>Баланс</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((a) => (
                      <AccountEditRow
                        key={a.id}
                        account={a}
                        onApplied={reloadAccounts}
                        showPlatformColumn={platformId === "all"}
                        onClipboardCopy={showClipboardToast}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
    {clipboardToast &&
      createPortal(
        <div className="clipboard-toast-root" role="status" aria-live="polite">
          <div className="clipboard-toast">
            <div className="clipboard-toast-label">Скопировано в буфер обмена:</div>
            <div className="clipboard-toast-value">{clipboardToast}</div>
          </div>
        </div>,
        document.body
      )}
  </>
  );
}
