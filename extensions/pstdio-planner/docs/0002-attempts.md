# Implementation variants

Planner links implementation workspaces, sessions, committed revisions, and optional reviews to a ticket. The responsible agent maintains ticket progress.

## Start and continue work

Use **Run attempt** on a ticket, or `pst pstdio-planner run-attempt --ticket PS-123`. Planner checks prerequisites, pending implementation input, and execution capacity. It reuses a suitable linked workspace and its implementation conversation. Request **Explore another implementation variant** only when another approach is useful.

Most tickets need one workspace. When several variants exist, select the intended variant with `select-attempt`. Selection does not change ticket progress. Retired variants remain in history and do not supply automatic dispatch or dependency commits.

`pst tickets implement --id PS-123` starts the responsible agent without creating a managed workspace. The agent discovers current status IDs and follows the project's implementation instructions.

## Submit revisions

After validation and the configured adversarial review, the implementation agent commits, saves a change request report, and records it:

```sh
pst pstdio-planner submit-revision --workspace-id <workspace> --implementation-session-id <session> --head-sha <head> --change-request-report-id <report>
```

Planner checks workspace/session ownership, actual HEAD, saved-report ownership, pending implementation input, dependency ancestry, and concurrent writes. Repeating the same commit/report submission is idempotent. A later correction appends a revision. A previous passing verdict stays attached to its original commit and does not block a new submission.

Use `list-variants` and `read-attempt-history` to inspect work. The older `submit-change-request`, `list-attempts`, and `expectedAttemptState` interfaces are deprecated. Their compatibility state describes evidence only and does not control workflow.

## Optional reviews

The implementation skill's adversarial review is the normal review step. A handoff status does not ask Planner to launch another reviewer. For an explicit additional review, use `run-review --workspace-id <workspace> --expected-revision <number>`.

A review records its owner, reviewed SHA, verdict, report, and findings. Submission verifies the exact current commit. Recording or dismissing a verdict does not change ticket status, resume implementation, or manufacture a merge decision. The implementation agent addresses relevant findings under the task instructions.

## Progress and dependencies

Configure completed, blocked, active, and optional merge-destination statuses in **Settings → Project → Planner workflow**. Selections use IDs and survive renaming or reordering. Missing selections remain visible and require repair. Empty selections disable only the corresponding status convenience.

The responsible agent uses `pst statuses list` and `implementation-policy`, then updates ticket status when starting, blocking, resuming, handing off, and meeting the actual delivery requirements. Users can override progress. Finishing a variant or opening a draft PR does not satisfy a task that requires merge or acceptance.

Prerequisites use configured completion or selected/unambiguous submitted commits. Active replacement execution, missing revisions, ambiguous variants, cycles, and implementation decisions still block affected work. Submitted stacking does not require a managed review verdict. Independent dependency branches require a validated integration commit; record it with `update-stack` before submission. Verified squash-merge evidence identifies the merged commit without inventing ancestry.

Merge-only requests block merge and merged-prerequisite dispatch. They do not block otherwise authorized submitted stacking. Product and security decisions block implementation. See [Review requests](0006-review-requests.md).

## Recovery and delivery

Execution capacity counts distinct live implementation sessions until they end, including PR and CI work after submission. Reviews remain separate. Known unexpected execution loss permits one same-conversation recovery. Explicit user stop and historical cancellation without evidence stay stopped for inspection.

Use `repair-attempt` to ask the current owner to continue a correction. HEAD and ownership are checked. Live owners receive a queued follow-up; queueing does not transfer the branch to another writer. Submission, repair, and optional review never imply approval to merge.

**Mark done on merge** remains a separate user policy. Enable it and choose **Status after merge** from completed statuses. Missing configuration leaves tickets unchanged and reports the required setting. Local merges and verified GitHub merge checks follow that destination. GitHub checks require authenticated `gh` on the host. Merging does not archive tickets or delete workspaces.
