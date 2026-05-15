import type { VercelRequest, VercelResponse } from "@vercel/node";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function backendBase(): string | null {
  const raw = process.env.BACKEND_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function getSetCookies(r: Response): string[] {
  const h = r.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const single = r.headers.get("set-cookie");
  return single ? [single] : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backend = backendBase();
  if (!backend) {
    res.status(500).json({
      error:
        "На Vercel не задан BACKEND_URL (URL вашего API, например http://1.2.3.4:3001)",
    });
    return;
  }

  const host = (req.headers.host as string) || "localhost";
  const href = req.url?.startsWith("http") ? req.url : `http://${host}${req.url || "/"}`;
  const url = new URL(href);
  const sub = url.pathname.replace(/^\/api(\/|$)/, "");
  const pathOnBackend = sub ? `/api/${sub}` : "/api";
  const target = `${backend}${pathOnBackend}${url.search}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", "https");

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    if (typeof req.body === "string") {
      init.body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      init.body = new Uint8Array(req.body);
    } else if (req.body !== undefined && req.body !== null) {
      init.body = JSON.stringify(req.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    res.status(502).json({
      error: "Прокси не достучался до BACKEND_URL. Проверьте IP/порт и файрвол.",
      detail: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  res.status(upstream.status);

  for (const c of getSetCookies(upstream)) {
    res.appendHeader("set-cookie", c);
  }

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") return;
    if (lower === "content-encoding" || lower === "transfer-encoding") return;
    res.setHeader(key, value);
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

export const config = {
  maxDuration: 60,
};
