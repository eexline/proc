import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = (process.env.BACKEND_URL ?? "").trim().replace(/\/$/, "");

const rewrites = [];

if (backend) {
  rewrites.push({
    source: "/api/:path*",
    destination: `${backend}/api/:path*`,
  });
  console.log(`[vercel] API proxy → ${backend}/api/*`);
} else {
  console.warn(
    "[vercel] BACKEND_URL не задан — /api на Vercel не будет проксироваться. Задайте переменную в Vercel → Environment Variables."
  );
}

rewrites.push({
  source: "/(.*)",
  destination: "/index.html",
  has: [{ type: "header", key: "accept", value: "text/html" }],
});

const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  buildCommand: "npm run build",
  outputDirectory: "dist",
  rewrites,
};

fs.writeFileSync(
  path.join(root, "vercel.json"),
  `${JSON.stringify(config, null, 2)}\n`,
  "utf8"
);
