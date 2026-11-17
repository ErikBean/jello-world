# jello-world

An agentic hello world.

This repo is for experimenting with shipping code via agents. The goal is a website that says **jello world!**, hosted on Amazon S3 behind Amazon CloudFront.

The site will be built and deployed with:

- [AWS CDK](https://aws.amazon.com/cdk/) for the infrastructure
- The AWS agent toolkit for working with AWS from an agent
- [Claude Code](https://claude.com/claude-code) as the agent writing and shipping the code

## How it ships

Merging to `main` deploys to production. Changes reach `main` only through a pull request whose `test` check passed.

The CDK app in `bin/` and `lib/` deploys as three stages, chosen with `-c stage=dev|preview|prod` (see [`lib/stage.ts`](lib/stage.ts)):

| Stage | Deployed by | Stack name | CDK bootstrap |
| --- | --- | --- | --- |
| `dev` | The factory, from the developer's machine, as the `agent-builder` profile (`npm run dev:deploy`) | `jello-world-dev-<branch>` | default |
| `preview` | CI, for each pull request ([`preview.yml`](.github/workflows/preview.yml)) | `jello-world-preview-pr<number>` | `ci` |
| `prod` | CI, on every merge to `main` ([`deploy.yml`](.github/workflows/deploy.yml)) | `jello-world` | `ci` |

For now all three stages run in one AWS account, `431104483706` in `us-east-1`. That's the organization's management account, an interim exception until AWS raises the account quota. `preview` and `prod` deploy through a second CDK bootstrap with the `ci` qualifier, whose roles agents can't assume, so agents can't deploy to production from their machine. Every IAM role carries the `agent-boundary` permissions boundary, which CI checks with `scripts/check-role-boundaries.mjs`.

Each pull request also gets a production diff ([`prod-diff.yml`](.github/workflows/prod-diff.yml)), which compares it with the templates last deployed to production and needs no AWS credentials. Closing a pull request destroys its preview and its branch's `dev` stacks ([`dev-cleanup.yml`](.github/workflows/dev-cleanup.yml)).

### AWS roles

GitHub Actions reaches AWS through GitHub OIDC, with no stored keys. There are three roles, each pinned to this repository's numeric ID:

- `github-deploy-jello-world`, which only `main` can assume, deploys `prod`.
- `github-preview-jello-world`, which only this repo's pull request workflows can assume, deploys previews.
- `github-dev-cleanup-jello-world`, which only `destroy-dev.yml` on `main` can assume, deletes stacks tagged `project=jello-world` and `stage=dev`.

The deploy and preview roles come from [`.github/aws/github-deploy-role.yaml`](.github/aws/github-deploy-role.yaml), and the cleanup role from [`.github/aws/github-dev-cleanup-role.yaml`](.github/aws/github-dev-cleanup-role.yaml). Their ARNs are in the repo variables `AWS_DEPLOY_ROLE_ARN`, `AWS_PREVIEW_ROLE_ARN` and `AWS_DEV_CLEANUP_ROLE_ARN`.

The admin changes (these role stacks, the repo variables and the ruleset on `main`) are made by the developer in their own terminal, with their own admin sign-in, and never by an agent. Agents push and open pull requests as the `erikbean-agents` GitHub App, which has no admin rights. The GitHub OIDC identity provider is in the `github-deploy-jello-world` stack but serves the whole account, so move it out before deleting that stack.

### Factory skills

The factory's stage skills are pinned in `.agents/skills/`, with links from `.claude/skills/`, and the commit they came from is in `.agents/factory-skills.json`. To update them, run:

```bash
scripts/sync-factory-skills.sh <factory-skills checkout>
```

### Checks

```bash
npm test
npx tsc --noEmit
npx cdk synth --quiet -c stage=prod
node scripts/check-role-boundaries.mjs
```
