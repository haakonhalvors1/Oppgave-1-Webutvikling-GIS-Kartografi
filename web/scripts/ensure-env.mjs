import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");

const envPath = path.join(webDir, ".env");
const envExamplePath = path.join(webDir, ".env.example");

if (fs.existsSync(envPath)) {
  console.log("[setup] .env finnes allerede");
  process.exit(0);
}

if (!fs.existsSync(envExamplePath)) {
  console.warn("[setup] Fant ikke .env.example, hopper over oppsett");
  process.exit(0);
}

fs.copyFileSync(envExamplePath, envPath);
console.log("[setup] Opprettet .env fra .env.example");
console.log("[setup] Husk å fylle inn Supabase-verdier i .env");
