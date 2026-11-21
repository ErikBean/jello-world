import { App } from "aws-cdk-lib";
import { buildApp } from "../lib/app";
import { devSlug } from "@favabean/factory-cdk";

// The dev cleanup workflow and the agents' prod and preview denies rely on
// these names, tags and bootstrap roles.
function synth(context: Record<string, string>) {
  const app = new App({ context: { ciQualifier: "ci", ...context } });
  buildApp(app);
  const stacks = app.synth().stacks;
  expect(stacks).toHaveLength(1);
  return stacks[0];
}

test("prod is the jello-world stack, deployed through the ci bootstrap", () => {
  const stack = synth({ stage: "prod" });
  expect(stack.stackName).toBe("jello-world");
  expect(stack.tags).toEqual({ project: "jello-world", stage: "prod" });
  expect(stack.assumeRoleArn).toContain("cdk-ci-deploy-role");
});

// Previews are off while the stages share an account (see the README). This
// keeps the stage's naming and ci bootstrap checked for when they return, and
// the agents' stage=preview deny still relies on the tag.
test("preview is named for the pull request and deployed through the ci bootstrap", () => {
  const stack = synth({ stage: "preview", pr: "12" });
  expect(stack.stackName).toBe("jello-world-preview-pr12");
  expect(stack.tags).toEqual({ project: "jello-world", stage: "preview" });
  expect(stack.assumeRoleArn).toContain("cdk-ci-deploy-role");
});

test("dev is named and tagged for the branch, deployed through the default bootstrap", () => {
  const stack = synth({ stage: "dev", branch: "factory/add-site" });
  const slug = devSlug("factory/add-site");
  expect(stack.stackName).toBe(`jello-world-dev-${slug}`);
  expect(stack.tags).toEqual({ project: "jello-world", stage: "dev", branch: slug });
  expect(stack.assumeRoleArn).toContain("cdk-hnb659fds-deploy-role");
});
