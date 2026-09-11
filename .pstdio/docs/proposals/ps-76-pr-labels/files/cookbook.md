# Operating guide

## Initial rollout

1. Inspect existing repository labels and Actions policies. Reuse equivalent labels when practical.
2. Create the seven automatic labels and two manual labels using the catalog descriptions.
3. Add the mapping, pinned action workflow, and repository documentation in an implementation PR.
4. Review the workflow permissions and confirm it does not check out or execute PR code.
5. Merge the configuration into the trusted branch, then validate with disposable PRs. The bootstrap PR cannot demonstrate rules that do not yet exist on that branch.
6. Record actual labels and policy results for every acceptance scenario. Enable `sdk-extension-separation` as a required status on `main` after a successful bootstrap run. Verify that a mixed PR is actually blocked. If a merge queue is enabled, validate the same status on merge groups first. Run the repository validation command before completing implementation.
7. Use the manual dispatch with a PR number to classify existing open PRs as needed.

## Everyday review

A PR changes an SDK method and a database schema. It receives `sdk` and `database`. The reviewer checks consumers and existing data. If the method breaks callers, the reviewer adds `breaking-change`. If a data transition is required, they add `needs-migration` and explain it.

A later commit reverts every SDK change. The automatic SDK label disappears after successful classification. Manual labels remain until a reviewer updates them because they represent review judgment.

## Updating mappings

Edit `.github/labeler.yml` when a sensitive package or boundary is added or moved. Update the guide if the label's meaning changes. Create any new repository label before activating its mapping. Rerun classification on relevant open PRs after merging the mapping.

Automatic labels are owned by the workflow. Manually removing one is temporary because a later matching run can restore it. Use the separate manual labels to record human judgment.

## Troubleshooting

If labels are missing, inspect the workflow run, label existence, permissions, and trusted mapping. Correct the cause and rerun. Never interpret an unlabeled PR as evidence of low risk. Record the selected action's rename behavior during validation so moves are understood rather than assumed to cover both old and new paths.

## Resolving a blocked PR

A PR changes `packages/sdk/src/` and `extensions/pstdio-planner/`. It receives `sdk` and `extensions`; `sdk-extension-separation` fails with instructions to split the changes.

Create an independently valid SDK PR and an extension PR. When adoption needs new SDK behavior, merge compatible SDK preparation first, update the extension PR base, then merge adoption. Remove obsolete SDK behavior in a later PR when consumers no longer need it. Each intermediate state must build and pass tests.

Deleting a managed label is not a bypass: synchronization restores it. Remove one area from the diff and let CI rerun. If label synchronization fails, fix the workflow and rerun; a failure must not be reported as policy success.
