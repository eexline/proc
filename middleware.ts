/** Прокси /api → BACKEND_URL (до SPA rewrite и статики). */
export const config = {
  matcher: ["/api", "/api/:path*"],
};

export default async function middleware(request: Request): Promise<Response> {
  const backend = process.env.BACKEND_URL?.trim().replace(/\/$/, "");
  if (!backend) {
    return new Response(
      JSON.stringify({ error: "На Vercel не задан BACKEND_URL" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const target = `${backend}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", "") || "https");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  return fetch(target, init);
}
