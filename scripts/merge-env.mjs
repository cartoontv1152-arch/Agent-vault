import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), ".env.local");
let input = "";
for await (const chunk of process.stdin) input += chunk;

const values = JSON.parse(input);
let contents = readFileSync(target, "utf8");

for (const [key, value] of Object.entries(values)) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== "string") {
    throw new Error("Environment input must contain string values with valid names.");
  }
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.replace(/\s*$/, "\n")}${line}\n`;
}

writeFileSync(target, contents, { encoding: "utf8", mode: 0o600 });
console.log("Updated the ignored local environment file.");
