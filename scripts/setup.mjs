import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), ".env.local");
const existing = existsSync(target) ? readFileSync(target, "utf8") : "";

if (existing) {
  if (/^SESSION_SECRET=.+$/m.test(existing)) {
    console.log(".env.local already contains a session secret; nothing changed.");
    process.exit(0);
  }
}

const defaults = existsSync(resolve(process.cwd(), ".env.example"))
  ? readFileSync(resolve(process.cwd(), ".env.example"), "utf8")
  : "SESSION_SECRET=\n";
const secret = randomBytes(48).toString("base64url");
const configured = existing
  ? /^SESSION_SECRET=.*$/m.test(existing)
    ? existing
    : `${existing.replace(/\s*$/, "\n")}SESSION_SECRET=${secret}\n`
  : defaults.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);

writeFileSync(target, configured, { encoding: "utf8" });
console.log(existing ? "Added a unique session secret to .env.local." : "Created .env.local with a unique session secret.");
