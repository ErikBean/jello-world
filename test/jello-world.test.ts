import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { JelloWorldStack } from "../lib/jello-world-stack";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { devSlug, stageFromContext } from "../lib/stage";

function synth(context: Record<string, string>) {
  const app = new App({ context });
  const stage = stageFromContext(app);
  const stack = new JelloWorldStack(app, "TestStack", { stage });
  return { stage, template: Template.fromStack(stack) };
}

test("prod synthesizes with no stack name suffix", () => {
  const { stage, template } = synth({ stage: "prod" });
  expect(stage.suffix).toBe("");
  expect(stage.ephemeral).toBe(false);
  expect(template.toJSON()).toBeDefined();
});

test("dev stacks are named per branch and are ephemeral", () => {
  const { stage } = synth({ stage: "dev", branch: "factory/add-site" });
  expect(stage.suffix).toMatch(/^-dev-factory-add-site-[0-9a-f]{8}$/);
  expect(stage.branch).toBe(stage.suffix.slice("-dev-".length));
  expect(stage.ephemeral).toBe(true);
});

test("preview stacks are named per pull request", () => {
  const { stage } = synth({ stage: "preview", pr: "12" });
  expect(stage.suffix).toBe("-preview-pr12");
});

test("a missing stage fails", () => {
  expect(() => synth({})).toThrow(/Pass the stage/);
});

const branches = [
  "factory/add-site",
  "feature/a",
  "feature-a",
  "feature_a",
  "--weird--/",
  "日本",
  `factory/${"x".repeat(60)}-one`,
  `factory/${"x".repeat(60)}-two`,
];

test("branches that read the same get different dev slugs", () => {
  const slugs = branches.map(devSlug);
  expect(new Set(slugs).size).toBe(branches.length);
  for (const slug of slugs) expect(slug).toMatch(/^([A-Za-z0-9]+(-[A-Za-z0-9]+)*-)?[0-9a-f]{8}$/);
});

test("destroy-dev.yml computes the same slug as devSlug", () => {
  const workflow = readFileSync(".github/workflows/destroy-dev.yml", "utf8");
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line.includes("readable=\"$("));
  const script = lines.slice(start, start + 3).map((line) => line.trim()).join("\n") + "\nprintf '%s' \"$slug\"";
  for (const branch of branches) {
    const slug = execFileSync("bash", ["-c", script], { env: { ...process.env, BRANCH: branch } }).toString();
    expect(slug).toBe(devSlug(branch));
  }
});
