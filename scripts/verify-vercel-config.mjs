import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.VERCEL) process.exit(0);

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "vercel.json");
const raw = fs.readFileSync(configPath, "utf8");

if (raw.includes("YOUR_PUBLIC_IP") || raw.includes("YOUR_SERVER_IP")) {
  console.error(
    "[vercel] В vercel.json остался плейсхолдер IP. Уберите rewrite на /api или замените IP.\n" +
      "       Для прокси задайте BACKEND_URL=http://ПУБЛИЧНЫЙ_IP:9000 в Environment Variables."
  );
  process.exit(1);
}
