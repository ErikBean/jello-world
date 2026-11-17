import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stage } from "./stage";

export interface JelloWorldStackProps extends StackProps {
  /** The stage being deployed. Constructs read stage.ephemeral to decide whether their data outlives the stack. */
  stage: Stage;
}

export class JelloWorldStack extends Stack {
  constructor(scope: Construct, id: string, props: JelloWorldStackProps) {
    super(scope, id, props);
    // The site's resources go here. The factory adds them from an OpenSpec change.
  }
}
