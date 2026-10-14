Implement ticket {{ticket}} in workspace {{workspaceId}}. Reuse this workspace and conversation for normal work and corrections.

Follow the `implement-ticket` skill. Read `pst statuses list` and `pst pstdio-planner implementation-policy`. You own ticket progress: update by current status ID when starting, blocking, resuming, handing off, and satisfying the actual delivery criteria. Labels may be renamed freely. A handoff does not request another managed review.

Perform required validation, the configured adversarial review, PR work, and latest-head CI under the task instructions. Record committed work and saved reports through `submit-revision`. Keep prior verdicts on their original commits.

If a person must decide or act, use `pst pstdio-planner request-human` for {{ticket}} with `--workspace-id {{workspaceId}}` and your implementation session ID. Explain the concrete decision and evidence. Mark the appropriate blocked status before pausing dependent work. Follow the skill’s “When stuck” workflow. Merge-only requests use `--affected-action merge`; they do not authorize merging.
