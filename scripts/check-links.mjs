// Verifies every URL in src/data/regulations.js actually resolves.
// Regulations content is only as good as its links — this is the machine-check
// that backs the "every URL gets verified" rule in CLAUDE.md.
//
// Imports the real data module (src/package.json scopes that tree to ESM) rather
// than regex-scanning source text, so dynamically-built URLs — template literals
// and fallbackFor()'s per-state links — are checked with their real, resolved
// values instead of being missed or mis-extracted.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { FEDERAL_ITEMS, STATE_REGS, STATE_NAMES, fallbackFor } from "../src/data/regulations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function collectUrls() {
  const urls = new Set();
  const addAll = (items) => items.forEach((item) => urls.add(item.url));

  addAll(FEDERAL_ITEMS);
  for (const code of Object.keys(STATE_REGS)) {
    Object.values(STATE_REGS[code].categories).forEach(addAll);
  }
  // Every state without curated data still ships fallbackFor() links to real
  // users — check those resolved URLs too, not just the curated 10 states.
  for (const code of Object.keys(STATE_NAMES)) {
    if (STATE_REGS[code]) continue;
    Object.values(fallbackFor(code).categories).forEach(addAll);
  }
  return [...urls];
}

async function attempt(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  let result = await attempt(url, "HEAD");
  if (!result.ok) result = await attempt(url, "GET"); // many origins don't support HEAD, or bot-gate it
  return { url, ...result };
}

async function main() {
  const urls = collectUrls();
  console.log(`Checking ${urls.length} unique URLs resolved from ${path.relative(process.cwd(), path.join(__dirname, "..", "src", "data", "regulations.js"))}...\n`);

  const results = await Promise.all(urls.map(checkUrl));
  const failures = results.filter((r) => !r.ok);

  for (const r of results) {
    const mark = r.ok ? "OK  " : "FAIL";
    console.log(`${mark}  ${r.status ?? "ERR"}  ${r.url}${r.error ? `  (${r.error})` : ""}`);
  }

  console.log(`\n${results.length - failures.length}/${results.length} URLs OK.`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} URL(s) failed:`);
    for (const f of failures) {
      console.error(`  - ${f.url}${f.error ? `  (${f.error})` : ""}`);
    }
    process.exit(1);
  }
}

main();
