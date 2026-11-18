// Which stage this synth or deploy is for, and the suffix that keeps its stack
// names apart: dev stacks per branch in the agent account, preview stacks per
// pull request in the preview account, and one prod stack set in production.
// Pass the stage with -c stage=<dev|preview|prod>, plus -c branch=<branch> for
// dev or -c pr=<number> for preview.
import { createHash } from "node:crypto";
import { App } from "aws-cdk-lib";

export type StageName = "dev" | "preview" | "prod";

export interface Stage {
  name: StageName;
  /**
   * Appended to every stack name, such as "-dev-factory-add-login" or
   * "-preview-pr12". Empty for prod, so production stacks keep the names they
   * had before the app had stages.
   */
  suffix: string;
  /**
   * True for dev and preview, whose data is deleted with their stacks. Buckets
   * need it on their own props, since autoDeleteObjects requires a DESTROY
   * removal policy on the bucket itself:
   *   removalPolicy: stage.ephemeral ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
   *   autoDeleteObjects: stage.ephemeral,
   */
  ephemeral: boolean;
  /**
   * For dev, the branch as it appears in stack names and in the stacks'
   * "branch" tag, by which the dev cleanup workflow finds them when the
   * branch's pull request closes. See devSlug.
   */
  branch?: string;
  /**
   * The CDK bootstrap qualifier to deploy with, when it isn't the default.
   * Always set for preview and prod, from cdk.json's "ciQualifier" context
   * value, because they share an account with dev and must deploy through a
   * separate bootstrap that agents can't use. Pass it to the stack's
   * synthesizer.
   */
  qualifier?: string;
}

export function stageFromContext(app: App): Stage {
  const name = app.node.tryGetContext("stage");
  // All three stages share one account for now, so prod and preview must not
  // fall back to the default bootstrap, whose roles agents can assume for dev.
  const ciQualifier = (): string => {
    const qualifier = String(app.node.tryGetContext("ciQualifier") ?? "");
    if (!qualifier) throw new Error(`${name} deploys through the ci bootstrap: set "ciQualifier" in cdk.json's context`);
    return qualifier;
  };
  if (name === "prod") return { name, suffix: "", ephemeral: false, qualifier: ciQualifier() };
  if (name === "dev") {
    const branch = String(app.node.tryGetContext("branch") ?? "");
    if (!branch) throw new Error("dev needs the branch: -c stage=dev -c branch=<branch>");
    const slug = devSlug(branch);
    return { name, suffix: `-dev-${slug}`, ephemeral: true, branch: slug };
  }
  if (name === "preview") {
    const pr = String(app.node.tryGetContext("pr") ?? "");
    if (!/^[0-9]+$/.test(pr)) throw new Error("preview needs the pull request number: -c stage=preview -c pr=<number>");
    return { name, suffix: `-preview-pr${pr}`, ephemeral: true, qualifier: ciQualifier() };
  }
  throw new Error("Pass the stage: -c stage=dev, preview or prod");
}

/**
 * The branch as it appears in dev stack names and tags. Stack names allow
 * letters, digits and hyphens, up to 128 characters, so the readable part
 * replaces everything else with hyphens and stops at 50 characters. The hash of
 * the full branch name keeps branches that read the same apart, such as
 * feature/a and feature-a. .github/workflows/destroy-dev.yml computes the same
 * slug in shell; keep the two in step.
 */
export function devSlug(branch: string): string {
  const readable = branch.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "");
  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  return readable ? `${readable}-${hash}` : hash;
}
