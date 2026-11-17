#!/usr/bin/env node
import { App, DefaultStackSynthesizer, RemovalPolicies } from "aws-cdk-lib";
import { JelloWorldStack } from "../lib/jello-world-stack";
import { stageFromContext } from "../lib/stage";

const app = new App();

// The stage comes from -c stage=dev|preview|prod (see lib/stage.ts). preview
// and prod deploy through the "ci" bootstrap, which agents can't assume.
const stage = stageFromContext(app);

// The tags trace leftovers back to this repo and stage, and the dev cleanup
// workflow finds a branch's stacks by them. They're set on each stack, not with
// Tags.of(app): with the @aws-cdk/core:explicitStackTags flag on, as cdk.json
// has it, Tags.of() never reaches the stack. CloudFormation copies stack tags
// to the resources it creates.
const tags: Record<string, string> = { project: "jello-world", stage: stage.name };
if (stage.branch) tags.branch = stage.branch;

new JelloWorldStack(app, "JelloWorldStack", {
  stackName: `jello-world${stage.suffix}`,
  stage,
  tags,
  ...(stage.qualifier && { synthesizer: new DefaultStackSynthesizer({ qualifier: stage.qualifier }) }),
});

if (stage.ephemeral) RemovalPolicies.of(app).destroy();
