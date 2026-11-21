// Smoke-tests a deployed stage: requests every URL the deploy output, follows
// redirects, and fails unless each ends in a 200 whose body contains the
// expected text. The app's own check is that text, given by `dev:smoke`.
// Usage: node scripts/smoke.mjs <outputs.json> <expected text>
import { stackUrls } from "./stack-urls.mjs";

const [outputs, expected] = process.argv.slice(2);
if (!outputs || !expected) {
  console.error("usage: node scripts/smoke.mjs <outputs.json> <expected text>");
  process.exit(2);
}

const urls = stackUrls(outputs);
if (urls.length === 0) {
  console.error(`No Url outputs in ${outputs}, so there is nothing to smoke-test.`);
  process.exit(1);
}

let failed = false;
for (const url of urls) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    const problem =
      response.status !== 200 ? `status ${response.status}` : body.includes(expected) ? null : `no "${expected}" in the page`;
    console.log(`${problem ? "FAIL" : "ok  "} ${url}${problem ? `: ${problem}` : ""}`);
    failed ||= Boolean(problem);
  } catch (error) {
    console.log(`FAIL ${url}: ${error.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
