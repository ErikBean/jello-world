#!/usr/bin/env node
// Says whether the factory skills pinned in .agents/factory-skills.json are
// behind the factory's latest release, the v* tag apps take the factory at.
// CI runs it on every pull request and the factory orchestrator runs it
// before a build. A source with no release tags is compared with its default
// branch.
//
// Usage: node scripts/check-factory-skills.mjs [factory git URL or path]
//
// The source defaults to the pin file's "source", fetched over HTTPS. Only
// changes to the pinned skills, and stage skills added upstream since, count.
// It only warns: it exits 0 whether the pin is current, behind or can't be
// checked, so a GitHub outage never blocks a merge.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pinFile = ".agents/factory-skills.json";
const inActions = process.env.GITHUB_ACTIONS === "true";

function warn(title, text) {
  console.log(`${title}\n${text}`);
  if (inActions) {
    // Workflow commands end at a newline, so encode the ones in the text.
    const body = text.replace(/%/g, "%25").replace(/\r?\n/g, "%0A");
    console.log(`::warning title=${title}::${body}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\n\`\`\`text\n${text}\n\`\`\`\n`);
  }
}

if (!existsSync(pinFile)) {
  console.log(`No ${pinFile}, so no factory skills are pinned here.`);
  process.exit(0);
}

const pin = JSON.parse(readFileSync(pinFile, "utf8"));
// CI has no SSH key, and the factory is public, so read it over HTTPS.
const source = (process.argv[2] ?? pin.source ?? "").replace(/^git@github\.com:/, "https://github.com/");
if (!source || !pin.commit) {
  warn("Factory skills pin unreadable", `${pinFile} needs a "source" and a "commit".`);
  process.exit(0);
}

const short = pin.commit.slice(0, 7);
const update = "Run scripts/sync-factory-skills.sh <factory checkout> and commit the result to update.";
const work = mkdtempSync(join(tmpdir(), "factory-skills-"));
const git = (...args) => execFileSync("git", ["-C", work, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// The highest vX.Y.Z tag, leaving out prereleases.
function latestRelease() {
  const tags = git("ls-remote", "--tags", "--refs", source, "v*")
    .split("\n")
    .map((line) => line.split("\t")[1]?.replace("refs/tags/", ""))
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag ?? ""));
  const parts = (tag) => tag.slice(1).split(".").map(Number);
  tags.sort((a, b) => {
    const [pa, pb] = [parts(a), parts(b)];
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
  return tags.at(-1);
}

function check() {
  git("init", "-q");
  let target;
  try {
    target = latestRelease() ?? "HEAD";
    // Trees and commits are enough to see what changed, so skip file contents.
    git("fetch", "-q", "--filter=blob:none", source, target === "HEAD" ? "HEAD" : `refs/tags/${target}`);
  } catch (err) {
    warn("Factory skills not checked", `Couldn't fetch ${source}: ${String(err.stderr ?? err.message).trim()}`);
    return;
  }

  try {
    git("cat-file", "-e", `${pin.commit}^{commit}`);
  } catch {
    const where = target === "HEAD" ? "the default branch" : target;
    warn(
      "Factory skills pinned off the release",
      `The pinned commit ${short} isn't in ${where} of ${source}. Sync from a checkout of ${where}.\n${update}`,
    );
    return;
  }

  // Stage skills now upstream: every factory-* skill but repo setup, which
  // sync-factory-skills.sh doesn't copy.
  const upstream = git("ls-tree", "-d", "--name-only", "FETCH_HEAD", "skills/")
    .split("\n")
    .map((p) => p.replace(/^skills\//, ""))
    .filter((n) => n.startsWith("factory-") && n !== "factory-repo-setup");
  const names = [...new Set([...(pin.skills ?? []), ...upstream])];
  const paths = names.map((n) => `skills/${n}`);

  const commits = git("log", "--format=%h %s", `${pin.commit}..FETCH_HEAD`, "--", ...paths);
  if (!commits) {
    console.log(`Factory skills are up to date with ${source} at ${target} (pinned ${short}).`);
    return;
  }

  const changed = [
    ...new Set(
      git("diff", "--name-only", pin.commit, "FETCH_HEAD", "--", ...paths)
        .split("\n")
        .map((p) => p.split("/")[1]),
    ),
  ].sort();
  const count = commits.split("\n").length;
  warn(
    "Factory skills behind",
    [
      `The skills pinned here at ${short} are ${count} commit${count === 1 ? "" : "s"} behind ${source} at ${target}.`,
      `Changed: ${changed.join(", ")}`,
      "",
      commits,
      "",
      update,
    ].join("\n"),
  );
}

try {
  check();
} catch (err) {
  warn("Factory skills not checked", String(err.stderr || err.message).trim());
} finally {
  rmSync(work, { recursive: true, force: true });
}
