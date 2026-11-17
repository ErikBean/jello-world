import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { JelloWorldStack } from "../lib/jello-world-stack";
import { stageFromContext } from "../lib/stage";

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
  expect(stage.suffix).toBe("-dev-factory-add-site");
  expect(stage.ephemeral).toBe(true);
});

test("preview stacks are named per pull request", () => {
  const { stage } = synth({ stage: "preview", pr: "12" });
  expect(stage.suffix).toBe("-preview-pr12");
});

test("a missing stage fails", () => {
  expect(() => synth({})).toThrow(/Pass the stage/);
});
