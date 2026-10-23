# Skip Unchanged

Stop nightly builds from rebuilding code that has not changed. On a `schedule` run, this action looks for an earlier successful run of the **same commit** in the same workflow and sets `skip=true` when it finds one, so the expensive jobs can be gated with one `if:`.

Every scheduled workflow on a quiet repository pays for a full run of unchanged code, day after day. The [CI Cost Report](https://github.com/marketplace/actions/ci-cost-report) action flags those runs as "scheduled runs on unchanged commits"; this action is the fix.

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * *'

jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      skip: ${{ steps.c.outputs.skip }}
    steps:
      - id: c
        uses: Huckcity/skip-unchanged@v1

  build:
    needs: check
    if: needs.check.outputs.skip != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make test
```

The `check` job takes a few seconds (one billed minute). Everything behind it is skipped when the commit was already built.

## How it decides

| Situation | Result |
|---|---|
| Event is not `schedule` (push, pull_request, dispatch…) | never skips |
| No earlier successful run of this commit | runs |
| Earlier successful run of this commit exists | **skips** |
| …but it is older than `max-age-hours` (default 7 days) | runs, so dependency drift still gets caught weekly |
| Another run of this commit is still in progress | runs |
| API error | runs (fails open) and prints a warning |

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `token` | `${{ github.token }}` | Needs `actions: read` (the default token has it) |
| `events` | `schedule` | Events on which skipping is considered, comma-separated |
| `max-age-hours` | `168` | Rebuild unchanged code anyway after this many hours; `0` never rebuilds |
| `workflows` | current workflow | Other workflow files whose successful runs also count, comma-separated |
| `conclusions` | `success` | Run conclusions that count as "already built" |
| `cancel` | `false` | Also cancel the current run (it then shows as cancelled rather than finishing with skipped jobs) |

## Outputs

`skip` (`true`/`false`), `reason` (human-readable), `previous-run-url` (when an earlier run was found). The reason is also written to the job summary.

## Related

- [CI Cost Report](https://github.com/marketplace/actions/ci-cost-report): where the Actions minutes go, and what to cut.
- [Step Timing](https://github.com/marketplace/actions/step-timing): which steps got slower.
- [ci2actions.dev](https://ci2actions.dev): convert Jenkins, GitLab CI, Azure Pipelines, CircleCI, Bitbucket and Travis configs to GitHub Actions, and the [Actions cost calculator](https://ci2actions.dev/actions-cost-calculator/).

MIT. Issues and PRs welcome.
