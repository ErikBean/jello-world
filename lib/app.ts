import { App } from "aws-cdk-lib";
import { FactoryStack, FunctionUrlSite } from "@favabean/factory-cdk";

/** jello-world: one static site. The stage, names, tags and guardrails come from FactoryStack. */
export function buildApp(app: App): void {
  const stack = new FactoryStack(app, "JelloWorldStack", { project: "jello-world" });
  new FunctionUrlSite(stack, "Site", { source: "site" });
}
