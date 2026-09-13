# Pull request area labels

The `PR area labels` workflow marks changes that need focused review. Labels describe areas, not severity. A PR without an area label can still need careful review.

| Automatic label | Review focus |
| --- | --- |
| `extensions` | Extension behavior and use of public SDK contracts |
| `sdk` | Public SDK and API contracts, types, and consumer compatibility |
| `database` | Schemas, migrations, data integrity, and file storage |
| `extension-runtime` | Extension installation, lifecycle, bridges, and processes |
| `security` | Runtime authentication, secrets, webview access, and desktop isolation |
| `sync` | Event delivery, ordering, reconnects, and consistency |
| `release` | CI permissions, packaging, publishing, and label policy |

`.github/labeler.yml` is the executable mapping source. Whole-package rules include tests and documentation. Several labels can match one file. The security paths identify known boundaries and do not detect every security change.

Reviewers own two separate labels: `breaking-change` for incompatible behavior or contracts, and `needs-migration` for required data transitions. Explain the affected consumers or migration in the PR description. These labels are never managed by the workflow.

## SDK and extension separation

`sdk-extension-separation` fails when synchronized labels contain both `sdk` and `extensions`. Split those changes into independently valid PRs. Merge compatible SDK preparation first, then extension adoption, then remove obsolete SDK behavior when consumers no longer need it. `extension-runtime` does not trigger this rule by itself.

The workflow publishes pending before classification, then success, failure, or error on the evaluated PR head commit. It evaluates immediately after label synchronization; bot label events are not needed. Manually deleting an area label triggers reclassification and cannot clear the rule. A changed head or base during classification produces an error on the old evaluated head, never success on a newer commit. Runs are serialized by PR with cancellation disabled.

The pinned labeler has GitHub API limits: the files endpoint returns at most 3,000 files and a PR holds at most 100 labels. The policy reports an error for a diff over 3,000 files, fewer than seven free label slots before classification, or a full label list afterward. It never treats a partial classification as success. Remove unnecessary labels or split the diff, then rerun.

## Trusted execution

The workflow handles draft and fork PRs targeting `main` through `pull_request_target`. It reads the policy module and label mappings at the workflow's trusted commit SHA. It never checks out contribution code, installs dependencies, or runs contribution scripts. Changing policy files in a PR cannot activate those changes before merge.

Both actions are pinned to full commit SHAs. `actions/github-script` uses its Node 24 runtime to strip the trusted TypeScript module's types. The runner needs only contents read, PR write, and status write permissions. Labels must exist before rollout, so issue write permission is unnecessary.

The labeler includes additions and deletions using GitHub's `filename`. For a rename it matches the destination filename, not `previous_filename`. A move out of a mapped area therefore removes its old area label unless another changed file still matches. Review moves across boundaries with that behavior in mind.

## Maintain and rerun

Repository maintainers own the mappings. When a sensitive boundary moves, update `.github/labeler.yml`. Keep manual consequence labels out of that file. Create new repository labels before merging a mapping and update this guide when their meaning changes. Area labels use amber (`D4A72C`); manual consequence labels use red (`B60205`).

After merging rule changes, backfill open PRs with:

```bash
gh workflow run pr-risk-labels.yml --ref main -f pr-number=123
```

Opening, reopening, pushing commits, editing the base, and editing labels also refresh classification. A failed or interrupted run needs a rerun. Label absence is not approval.

## Rollout and required status

PS-78 implements Planner proposal PS-76. The existing repository ruleset has no merge queue. Do not enable a queue until this policy handles `merge_group`, evaluates each constituent PR independently, and publishes the context on the group SHA. Separate SDK-only and extension-only PRs in one group must remain valid.

The workflow must reach `main` before live acceptance or required-status activation. A new `pull_request_target` workflow cannot validate itself in its bootstrap PR.

1. Confirm all nine labels above exist with their descriptions.
2. Merge the implementation after review. Dispatch the workflow on a disposable draft PR.
3. Record actual labels and head statuses for SDK plus database, SDK plus extensions, either alone, neither, overlapping security/runtime paths, and manual consequence labels.
4. Revert the SDK changes and verify stale labels disappear. Delete a managed label manually and verify it returns. Repeat on a fork PR. Check base changes, additions, deletions, and a rename across mapped areas.
5. In the active `main` ruleset, add required status context `sdk-extension-separation` with the publishing integration set to GitHub Actions. Preserve the existing rules and bypass settings.
6. Verify a mixed PR is blocked and its corrected revision passes. Record the results in the PS-78 change request report, then close the disposable PRs.

A failing workflow alone does not enforce separation. Until step 5, the commit status is advisory. Do not require it before bootstrap succeeds: doing so would block every PR, including the PR needed to install the workflow.

## Local validation

```bash
bun test scripts/ci/pr-risk-labels.test.ts
bun run validate
```

The tests cover classification outcomes, reversions, failed classification, changed head/base snapshots, manual label removal during a run, and API errors. GitHub rollout checks above prove the actual hosted permissions and merge gate.
