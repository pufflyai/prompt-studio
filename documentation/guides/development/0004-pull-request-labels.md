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
| `dashboard-ui` | Core UI and dashboard chrome: compare with the live Canvas design and [DESIGN.md](../../../design/DESIGN.md) |

`.github/labeler.yml` is the executable mapping source. Whole-package rules include tests and documentation. `dashboard-ui` is the exception: it covers the sources of the dashboard, the workbench and `@pstdio/ui`, the dashboard's `index.html` and `public/` assets, the icon font and the design system file, but not test files or test fixtures, support, utilities and helpers. Stories, story fixtures and locale strings count. Extension views are not core UI: the `extensions` label tracks them. Several labels can match one file. The security paths identify known boundaries and do not detect every security change.

Reviewers own two separate labels: `breaking-change` for incompatible behavior or contracts, and `needs-migration` for required data transitions. Explain the affected consumers or migration in the PR description. These labels are never managed by the workflow.

The PR author owns `waiting-for-release`. Add it to an extension PR that uses SDK or UI changes that are merged but not yet published to npm. Name the SDK or UI PR it waits for in the description. The `published_extensions` CI job fails on such a PR until the next release, so do not merge it. After the release, raise the extension's `@pstdio/sdk` or `@pstdio/ui` range to the published version, rerun CI, and remove the label once `published_extensions` passes. The workflow never manages this label.

`removed-from-queue` is not an area label. The **Merge queue removals** workflow manages it; see [When a PR leaves the queue](0015-ci-stages.md#when-a-pr-leaves-the-queue).

`ci:full` is not an area label. A person adds it to request separate full functional diagnostics for a same-repository PR. The trusted label handler dispatches the trusted base-branch Test and Build workflow with `profile=production` and the exact PR merge SHA as `source_sha`. That run reports `production_ci_passed`; it does not replace or delay the ordinary required `ci_passed` fast gate. Fork PRs receive an explicit manual diagnostic instruction instead of automatic dispatch. These functional diagnostics are not an immutable release certificate and do not replace P3 performance qualification. See [request deeper diagnostics](0015-ci-stages.md#extra-diagnostics).

## SDK and extension separation

`sdk-extension-separation` fails when synchronized labels contain both `sdk` and `extensions`. Split those changes into independently valid PRs. Merge compatible SDK preparation first, then extension adoption, then remove obsolete SDK behavior when consumers no longer need it. `extension-runtime` does not trigger this rule by itself.

The workflow publishes pending before classification, then success, failure, or error on the evaluated PR head commit. It evaluates immediately after label synchronization; bot label events are not needed. Manually deleting an area label triggers reclassification and cannot clear the rule. A changed head or base during classification produces an error on the old evaluated head, never success on a newer commit. Runs are serialized by PR with cancellation disabled.

The pinned labeler has GitHub API limits: the files endpoint returns at most 3,000 files and a PR holds at most 100 labels. The policy reports an error for a diff over 3,000 files, fewer than eight free label slots before classification, or a full label list afterward. It never treats a partial classification as success. Remove unnecessary labels or split the diff, then rerun.

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

## Current enforcement

PS-78 implements PRD PS-76. The CI architecture retains the existing `ci_passed` required context and ALLGREEN merge queue (see [CI stages](0015-ci-stages.md)). It does not require replacing that context or weakening protection when the job layout changes. `sdk-extension-separation` remains advisory under the documented policy. Repository settings can change independently of this checkout; inspect the active ruleset and check identity before changing enforcement.

The area-label workflow evaluates pull request heads and manual dispatches.

After changing the policy, verify it on disposable PRs:

1. Check SDK plus database, SDK plus extensions, either alone, neither, overlapping security/runtime paths, and manual consequence labels.
2. Revert SDK changes and verify stale labels disappear. Delete a managed label and verify reclassification restores it.
3. Check forks, base changes, additions, deletions, and renames across mapped areas.
4. Verify mixed-PR blocking before making the context required. Preserve existing rules and bypass settings.

A failing workflow alone does not enforce separation. Current whole-package mappings also flag documentation-only README changes in both areas; they do not distinguish public API changes from link repairs.

## Local validation

```bash
bun test scripts/ci/pr-risk-labels.p0.test.ts
```

The tests cover classification outcomes, reversions, failed classification, changed head/base snapshots, manual label removal during a run, and API errors. GitHub rollout checks above prove the actual hosted permissions and merge gate.
