import type {
  Account,
  AccountStatus,
  AuthUser,
  Bank,
  Platform,
  UserListItem,
  UserRole,
} from "./types";

/** Same-origin: dev → Vite proxy, prod → vercel.json rewrites */
const base = "";

function notifySessionLost(res: Response, url: string) {
  if (res.status !== 401) return;
  if (url.includes("/api/auth/login")) return;
  window.dispatchEvent(new CustomEvent("lk-auth-lost"));
}

async function parseJson<T>(res: Response, url: string): Promise<T> {
  const text = await res.text();
  notifySessionLost(res, url);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function req<T>(input: string, init?: RequestInit): Promise<T> {
  const path = input.startsWith("/") ? input : `/${input}`;
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return parseJson<T>(res, input);
}

export const api = {
  platforms(): Promise<Platform[]> {
    return req("/api/platforms");
  },

  banks(): Promise<Bank[]> {
    return req("/api/banks");
  },

  accounts(platformId: string | "all", status?: AccountStatus | "all"): Promise<Account[]> {
    const q = new URLSearchParams({ platformId });
    if (status) q.set("status", status);
    return req(`/api/accounts?${q}`);
  },

  authMe(): Promise<{ user: AuthUser | null }> {
    return req("/api/auth/me");
  },

  login(body: { login: string; password: string }): Promise<{ user: AuthUser }> {
    return req("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return req("/api/auth/logout", { method: "POST" });
  },

  listUsers(): Promise<UserListItem[]> {
    return req("/api/users");
  },

  createUser(body: {
    login: string;
    password: string;
    role: UserRole;
  }): Promise<UserListItem> {
    return req("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deleteUser(id: string): Promise<{ ok: boolean }> {
    return req(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createPlatform(name: string): Promise<Platform> {
    return req("/api/platforms", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  deletePlatform(id: string): Promise<{ ok: boolean }> {
    return req(`/api/platforms/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createBank(name: string): Promise<Bank> {
    return req("/api/banks", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  deleteBank(id: string): Promise<{ ok: boolean }> {
    return req(`/api/banks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createAccount(body: {
    platformId: string;
    status: AccountStatus;
    fullName: string;
    bankId?: string;
    comment: string;
    balance: string;
  }): Promise<Account> {
    return req("/api/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deleteAccount(id: string): Promise<{ ok: boolean }> {
    return req(`/api/accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  updateAccount(
    id: string,
    body: {
      status?: AccountStatus;
      balance?: string;
      comment?: string;
      transferLimitUntil?: string | null;
      coolingUntil?: string | null;
      fullName?: string;
      bankId?: string | null;
    }
  ): Promise<Account> {
    return req(`/api/accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  sendDigest(slot?: "morning" | "evening"): Promise<{ ok: boolean; slot: string }> {
    return req("/api/admin/send-digest", {
      method: "POST",
      body: JSON.stringify(slot ? { slot } : {}),
    });
  },
};
