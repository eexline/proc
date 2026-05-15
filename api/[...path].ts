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

function targetUrl(req: VercelRequest, base: string): string {
  const segments = req.query.path;
  const tail = Array.isArray(segments)
    ? segments.join("/")
    : typeof segments === "string"
      ? segments
      : "";
  const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  return `${base}/api/${tail}${qs}`;
}

function requestBody(req: VercelRequest): string | undefined {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (typeof req.body === "string") return req.body;
  if (req.body === undefined || req.body === null) return undefined;
  return JSON.stringify(req.body);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const base = backendBase();
  if (!base) {
    res.status(500).json({
      error:
        "BACKEND_URL не задан. Vercel → Settings → Environment Variables → BACKEND_URL=http://ВАШ_IP:9000",
    });
    return;
  }

  const url = targetUrl(req, base);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: requestBody(req),
      redirect: "manual",
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower === "set-cookie") return;
      res.setHeader(key, value);
    });

    const cookies = upstream.headers.getSetCookie?.();
    if (cookies?.length) res.setHeader("set-cookie", cookies);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf.length ? buf : undefined);
  } catch (err) {
    res.status(502).json({
      error: "Не удалось подключиться к бэкенду",
      target: url.replace(base, base.replace(/\/\/[^/]+/, "//***")),
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
