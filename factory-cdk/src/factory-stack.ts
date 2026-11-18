// The base stack every factory-built app deploys. It carries the platform's
// rules so app code doesn't have to: the stage from context, per-stage stack
// names, the bootstrap qualifier that keeps agents out of preview and prod, the
// project/stage/branch tags the cleanup workflows rely on, the account's
// permissions boundary on every role, and a synth-time check that no role
// escapes it. Modelled on @guardian/cdk's GuStack, but with the modern
// synthesizer. Spike: would move to the shared construct package.
import {
  Annotations,
  AspectPriority,
  Aspects,
  CfnOutput,
  CfnResource,
  DefaultStackSynthesizer,
  IAspect,
  RemovalPolicies,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { CfnRole, CfnUser, ManagedPolicy, PermissionsBoundary } from "aws-cdk-lib/aws-iam";
import { Construct, IConstruct } from "constructs";
import { Stage, stageFromContext } from "./stage";

export interface FactoryStackProps extends Omit<StackProps, "stackName" | "synthesizer"> {
  /** The app's name. It names the stacks and goes in the "project" tag. */
  readonly project: string;
  /**
   * The permissions boundary policy every role must carry. Defaults to the
   * "@aws-cdk/core:permissionsBoundary" context value's name, then "agent-boundary".
   */
  readonly boundaryName?: string;
}

const BOUNDED_TYPES = [CfnRole.CFN_RESOURCE_TYPE_NAME, CfnUser.CFN_RESOURCE_TYPE_NAME];

/**
 * Whether a role or user resource will render with a PermissionsBoundary. CDK
 * attaches the boundary to most roles as a property, but to some of its own
 * helper roles (such as BucketDeployment's) as a raw property override, so both
 * are checked. This reads CfnResource internals; the shared package should pin
 * aws-cdk-lib's minor version and keep a test that a helper role passes.
 */
function hasBoundary(node: CfnResource): boolean {
  const n = node as unknown as {
    permissionsBoundary?: unknown;
    _cfnProperties?: { PermissionsBoundary?: unknown };
    rawOverrides?: { Properties?: { PermissionsBoundary?: unknown } };
  };
  return Boolean(n.permissionsBoundary ?? n._cfnProperties?.PermissionsBoundary ?? n.rawOverrides?.Properties?.PermissionsBoundary);
}

/** Fails synth for any IAM role or user without a permissions boundary. */
class RequireBoundary implements IAspect {
  visit(node: IConstruct): void {
    if (node instanceof CfnResource && BOUNDED_TYPES.includes(node.cfnResourceType) && !hasBoundary(node)) {
      Annotations.of(node).addError("Every IAM role and user needs the account's permissions boundary");
    }
  }
}

export class FactoryStack extends Stack {
  public readonly stage: Stage;
  public readonly project: string;

  constructor(scope: Construct, id: string, props: FactoryStackProps) {
    const stage = stageFromContext(scope);
    // Tags go on the stack itself: with @aws-cdk/core:explicitStackTags on,
    // Tags.of(app) never reaches the stack. CloudFormation copies stack tags
    // to the resources it creates.
    const tags: Record<string, string> = { ...props.tags, project: props.project, stage: stage.name };
    if (stage.branch) tags.branch = stage.branch;

    super(scope, id, {
      ...props,
      stackName: `${props.project}${stage.suffix}`,
      tags,
      ...(stage.qualifier && { synthesizer: new DefaultStackSynthesizer({ qualifier: stage.qualifier }) }),
    });
    this.stage = stage;
    this.project = props.project;

    const fromContext = this.node.tryGetContext("@aws-cdk/core:permissionsBoundary")?.name;
    const boundaryName = props.boundaryName ?? fromContext ?? "agent-boundary";
    PermissionsBoundary.of(this).apply(ManagedPolicy.fromManagedPolicyName(this, "Boundary", boundaryName));
    Aspects.of(this).add(new RequireBoundary(), { priority: AspectPriority.READONLY });

    if (stage.ephemeral) RemovalPolicies.of(this).destroy();
  }

  /** Adds a stack output that the preview comment and smoke test pick up. */
  public addUrl(id: string, url: string): CfnOutput {
    return new CfnOutput(this, `Url${id}`, { value: url });
  }
}
