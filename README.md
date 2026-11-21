# jello-world

An agentic hello world.

This repo is for experimenting with shipping code via agents. The goal is a website that says **jello world!**, hosted on Amazon S3 behind Amazon CloudFront.

The site will be built and deployed with:

- [AWS CDK](https://aws.amazon.com/cdk/) for the infrastructure
- The AWS agent toolkit for working with AWS from an agent
- [Claude Code](https://claude.com/claude-code) as the agent writing and shipping the code

## How it ships

Merging to `main` deploys to production. Changes reach `main` only through a pull request whose `test / test` check passed and that the developer approved.

The app is [`lib/app.ts`](lib/app.ts): one `StaticSite` in a `FactoryStack`, both from [`@favabean/factory-cdk`](https://www.npmjs.com/package/@favabean/factory-cdk). The stack carries the platform's rules, so this repo doesn't copy them: the stage, stack names and tags, the `ci` bootstrap for prod, and the `agent-boundary` permissions boundary on every IAM role, checked when it synthesizes.

| Stage | Deployed by | Stack name | CDK bootstrap |
| --- | --- | --- | --- |
| `dev` | The factory, from the developer's machine, as the `agent-builder` profile (`npm run dev:deploy`) | `jello-world-dev-<branch>-<hash>` | default |
| `prod` | CI, on every merge to `main` | `jello-world` | `ci` |

All stages run in one AWS account for now, `431104483706` in `us-east-1`, the organization's management account. That's an interim exception until AWS raises the account quota. Prod deploys through the `ci` bootstrap, whose roles agents can't assume, so agents can't deploy to production from their machine. There are no per-pull-request previews while the stages share an account.

### Workflows

The three workflows here call the factory's reusable workflows at a release tag, such as `@v0.2.0`. Dependabot proposes new releases.

| Workflow | On | Does |
| --- | --- | --- |
| [`ci.yml`](.github/workflows/ci.yml) | pull request | Tests, prod synth and boundary check (`test / test`); how the pull request changes production, with no AWS credentials (`prod-diff / prod-diff`); and a warning when the factory skills fall behind |
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | The tests again, then deploys `prod` |
| [`dev-cleanup.yml`](.github/workflows/dev-cleanup.yml) | pull request closed | Deletes that branch's `dev` stacks |

Dev cleanup runs on `pull_request_target`, so GitHub runs `main`'s copy of it, never the pull request's. It checks out `main`, skips pull requests from forks, and takes the branch from the closed pull request itself.

### AWS roles

GitHub Actions reaches AWS through GitHub OIDC, with no stored keys. The roles come from the factory's [`platform/github-oidc`](https://github.com/ErikBean/factory/tree/main/platform/github-oidc), which lists this repo in `apps.json`:

- `factory-deploy-jello-world` deploys `prod`.
- `factory-dev-cleanup-jello-world` can delete only stacks tagged `project=jello-world` and `stage=dev`.

Each trusts only this repo's `main` branch, pinned by the repo's numeric ID, running the matching factory workflow at a release tag. Only the factory's admin can create those tags. The workflows build the role ARNs from the repo variables `AWS_ACCOUNT_ID` and `AWS_REGION`.

The admin changes (the roles, the repo variables and the rulesets on `main`) are made by the developer in their own terminal, with their own admin sign-in, and never by an agent. Agents push and open pull requests as the `erikbean-agents` GitHub App, which has no admin rights. Only the developer merges: the `main-review` ruleset needs a code owner's approval of a pull request's latest push, [`CODEOWNERS`](.github/CODEOWNERS) names the developer, and a GitHub App can't be a code owner. [`.claude/hooks/block-merge.mjs`](.claude/hooks/block-merge.mjs) also refuses agents' merge, approve and push-to-`main` commands.

### Factory skills

The factory's stage skills are pinned in `.agents/skills/`, with links from `.claude/skills/`, and the commit they came from is in `.agents/factory-skills.json`. To update them, run:

```bash
scripts/sync-factory-skills.sh <factory-skills checkout>
```

The `factory-skills` job in CI runs `scripts/check-factory-skills.mjs` on every pull request. It warns, without failing the build, when a pinned skill has changed on factory-skills `main` since the pin. Run it yourself with `node scripts/check-factory-skills.mjs`.

### Checks

```bash
npm test
npx cdk synth --quiet -c stage=prod
npx factory-check-boundaries cdk.out
```
