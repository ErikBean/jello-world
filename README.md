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
| `dev` | The factory, from the developer's machine, as the `agent-builder` profile (`npm run dev:deploy`) | `jello-world-dev-<branch>-<hash>` | default |
| `preview` | CI, for each pull request ([`preview.yml`](.github/workflows/preview.yml)). Turned off for now, see below | `jello-world-preview-pr<number>` | `ci` |
| `prod` | CI, on every merge to `main` ([`deploy.yml`](.github/workflows/deploy.yml)) | `jello-world` | `ci` |

For now all three stages run in one AWS account, `431104483706` in `us-east-1`. That's the organization's management account, an interim exception until AWS raises the account quota. `preview` and `prod` deploy through a second CDK bootstrap with the `ci` qualifier, whose roles agents can't assume, so agents can't deploy to production from their machine. `lib/stage.ts` refuses to synthesize `preview` or `prod` without the `ci` qualifier. Every IAM role carries the `agent-boundary` permissions boundary, which CI checks with `scripts/check-role-boundaries.mjs`.

**Previews are turned off** while the stages share one account. There, `preview` and `prod` deploy through the same `ci` bootstrap roles, so a pull request's preview could change production stacks. Both `preview.yml` jobs skip unless the repo variable `PREVIEW_ENABLED` is `true`, and the preview role doesn't exist. Don't create it, or set the variable, until preview deploys through roles that can't reach prod stacks.

A `dev` stack name ends in a short hash of the full branch name (`devSlug` in `lib/stage.ts`), so branches such as `feature/a` and `feature-a` get separate stacks.

Each pull request also gets a production diff ([`prod-diff.yml`](.github/workflows/prod-diff.yml)), which compares it with the templates last deployed to production and needs no AWS credentials. Closing a pull request destroys its branch's `dev` stacks ([`dev-cleanup.yml`](.github/workflows/dev-cleanup.yml)), and its preview when previews are on. The production diff fails, rather than passing, when it can't read the last deploy for any reason other than nothing being deployed yet or the saved templates having expired.

### AWS roles

GitHub Actions reaches AWS through GitHub OIDC, with no stored keys. There are two roles in use, each pinned to this repository's numeric ID:

- `github-deploy-jello-world`, which only `main` can assume, deploys `prod`.
- `github-dev-cleanup-jello-world`, which only `destroy-dev.yml` on `main` can assume, deletes stacks tagged `project=jello-world` and `stage=dev`. `destroy-dev.yml` takes the branch from the pull request event, not from its caller, so a pull request can only delete its own branch's stacks.

The deploy role comes from [`.github/aws/github-deploy-role.yaml`](.github/aws/github-deploy-role.yaml), which can also make a preview role once previews have their own isolation,, and the cleanup role from [`.github/aws/github-dev-cleanup-role.yaml`](.github/aws/github-dev-cleanup-role.yaml). Their ARNs are in the repo variables `AWS_DEPLOY_ROLE_ARN` and `AWS_DEV_CLEANUP_ROLE_ARN`.

The admin changes (these role stacks, the repo variables and the rulesets on `main`) are made by the developer in their own terminal, with their own admin sign-in, and never by an agent. Agents push and open pull requests as the `erikbean-agents` GitHub App, which has no admin rights. Only the developer merges: the `main-review` ruleset needs a code owner's approval of a pull request's latest push, [`CODEOWNERS`](.github/CODEOWNERS) names the developer, and a GitHub App can't be a code owner. [`.claude/hooks/block-merge.mjs`](.claude/hooks/block-merge.mjs) also refuses agents' merge, approve and push-to-`main` commands. The GitHub OIDC identity provider is in the `github-deploy-jello-world` stack but serves the whole account, so move it out before deleting that stack.

### Factory skills

The factory's stage skills are pinned in `.agents/skills/`, with links from `.claude/skills/`, and the commit they came from is in `.agents/factory-skills.json`. To update them, run:

```bash
scripts/sync-factory-skills.sh <factory-skills checkout>
```

The `factory-skills` job in CI runs `scripts/check-factory-skills.mjs` on every pull request. It warns, without failing the build, when a pinned skill has changed on factory-skills `main` since the pin. Run it yourself with `node scripts/check-factory-skills.mjs`.

### Checks

```bash
npm test
npx tsc --noEmit
npx cdk synth --quiet -c stage=prod
node scripts/check-role-boundaries.mjs
```
