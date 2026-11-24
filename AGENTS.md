# AGENTS.md

This is an AWS CDK app in TypeScript, built on the factory's construct library,
[`@favabean/factory-cdk`](https://www.npmjs.com/package/@favabean/factory-cdk).
The app is [`lib/app.ts`](lib/app.ts): one `FunctionUrlSite` in a `FactoryStack`, until AWS verifies the account for CloudFront and it can move to `StaticSite`.
`bin/jello-world.ts` creates the `App`, and `cdk.json` tells the CDK Toolkit how
to run it.

`FactoryStack` sets the stage from `-c stage=dev|prod`, the stack names, the
`project`, `stage` and `branch` tags, the bootstrap each stage deploys through,
and the `agent-boundary` permissions boundary on every IAM role. Synth fails for
a role without the boundary. Every stack must be a `FactoryStack`, and anything
that serves a URL outputs it with `stack.addUrl(...)`. `openspec/config.yaml`
has the rest of the project's rules.

## Read the construct library docs before writing code

AWS CDK service documentation ships inside the aws-cdk-lib package. After you
install dependencies with `npm install` (so `node_modules/aws-cdk-lib` exists)
and before you write your CDK constructs, find the service READMEs once:

```
find node_modules/aws-cdk-lib -name README.md
```

For each AWS service you use in this app, read that service's module README (for
example, `node_modules/aws-cdk-lib/aws-s3/README.md`) first and follow its
documented construct usage and patterns. Not every service has a README; a
missing one is not an error. Read the relevant READMEs before writing the
constructs for each service.

Before reading a service README, list its section headings with
`grep -n '^#' node_modules/aws-cdk-lib/<module>/README.md`, then read only the
sections for the constructs you use, for example with
`sed -n '<start>,<end>p' node_modules/aws-cdk-lib/<module>/README.md`. Do not
read a whole README into context or re-read a section you have already read.

## Check your work

- `npm test`: the jest tests.
- `npx tsc --noEmit`: type-check.
- `npx cdk synth --quiet -c stage=prod`: synthesize production. Every `cdk`
  command needs `-c stage=...`.
- `npx factory-check-boundaries cdk.out`: every IAM role has the boundary.
- `npx openspec ...`: the OpenSpec CLI, installed with the repo. Where a skill
  says `openspec`, run `npx openspec`.

## Deploying

- Deploy only `dev`, as the `agent-builder` profile: `npm run dev:deploy`,
  then `npm run dev:smoke` to check the site. The stacks are named and tagged
  for the current branch, and stay up while its pull request is open, so the
  developer can try it. CI deletes them when the pull request closes;
  `npm run dev:destroy` removes them sooner if you need to.
- Never deploy `prod`. CI deploys it when a pull request merges to `main`, and
  agents can't assume its bootstrap roles.

## More resources

- [AWS CDK Reference](https://docs.aws.amazon.com/cdk/api/)
