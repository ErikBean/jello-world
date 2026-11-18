import { App, DefaultStackSynthesizer, RemovalPolicies } from "aws-cdk-lib";
import { JelloWorldStack } from "./jello-world-stack";
import { stageFromContext } from "./stage";

/**
 * Adds this app's stacks to the app, for the stage in its context (see
 * lib/stage.ts). preview and prod deploy through the "ci" bootstrap, which
 * agents can't assume.
 */
export function buildApp(app: App): void {
  const stage = stageFromContext(app);

  // The tags trace leftovers back to this repo and stage, and the dev cleanup
  // workflow finds a branch's stacks by them. They're set on each stack, not
  // with Tags.of(app): with the @aws-cdk/core:explicitStackTags flag on, as
  // cdk.json has it, Tags.of() never reaches the stack. CloudFormation copies
  // stack tags to the resources it creates.
  const tags: Record<string, string> = { project: "jello-world", stage: stage.name };
  if (stage.branch) tags.branch = stage.branch;

  new JelloWorldStack(app, "JelloWorldStack", {
    stackName: `jello-world${stage.suffix}`,
    stage,
    tags,
    ...(stage.qualifier && { synthesizer: new DefaultStackSynthesizer({ qualifier: stage.qualifier }) }),
  });

  if (stage.ephemeral) RemovalPolicies.of(app).destroy();
}
