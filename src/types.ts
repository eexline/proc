export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  login: string;
  role: UserRole;
}

export interface UserListItem extends AuthUser {
  created_at: string;
}

export type AccountStatus =
  | "working"
  | "reserve"
  | "transfer_limits"
  | "blocked"
  | "needs_repair"
  | "cooling";

export interface Platform {
  id: string;
  name: string;
  created_at: string;
}

export interface Bank {
  id: string;
  name: string;
  created_at: string;
}

export interface Account {
  id: string;
  platform_id: string;
  status: AccountStatus;
  full_name: string;
  bank_name: string;
  bank_id: string | null;
  /** Не длиннее 32 символов (см. сервер и поле ввода). */
  comment: string;
  balance: string;
  /** Название площадки (из API при списке ЛК) */
  platform_name: string;
  /** YYYY-MM-DD при статусе «Лимиты на переводы» */
  transfer_limit_until: string | null;
  /** YYYY-MM-DD при статусе «Отлега» */
  cooling_until: string | null;
  created_at: string;
  /** Общая метка последней правки любого из полей ниже (для совместимости) */
  updated_at: string | null;
  updated_by_user_id: string | null;
  updated_by_login: string | null;
  status_updated_at: string | null;
  status_updated_by_user_id: string | null;
  status_updated_by_login: string | null;
  balance_updated_at: string | null;
  balance_updated_by_user_id: string | null;
  balance_updated_by_login: string | null;
  comment_updated_at: string | null;
  comment_updated_by_user_id: string | null;
  comment_updated_by_login: string | null;
}

export const STATUS_LABELS: Record<AccountStatus, string> = {
  working: "Рабочий",
  reserve: "Резерв",
  transfer_limits: "Лимиты на переводы",
  blocked: "Заблокирован",
  needs_repair: "Нужна починка",
  cooling: "Отлега",
};

export const STATUS_ORDER: AccountStatus[] = [
  "working",
  "reserve",
  "transfer_limits",
  "blocked",
  "needs_repair",
  "cooling",
];

export function isAccountStatus(s: string): s is AccountStatus {
  return (STATUS_ORDER as readonly string[]).includes(s);
}

export function statusLabel(s: string): string {
  return isAccountStatus(s) ? STATUS_LABELS[s] : s.trim() || "—";
}
