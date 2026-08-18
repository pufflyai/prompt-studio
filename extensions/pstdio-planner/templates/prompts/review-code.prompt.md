Review the changes in the current workspace for ticket: {{ticket}}.

Focus on:

* Identify gaps in the implementation.
* Identify logic errors, edge cases, or incorrect assumptions.
* Detect any behavior that may have been unintentionally broken.
* Highlight missing tests, insufficient coverage, or outdated tests.

### Expectations

* Reference specific **files and lines** where issues are found.
* Clearly distinguish between critical issues (must fix), minor issues (should fix), and suggestions (optional improvements).

### Output

Scaffold the review report by running `pst reports write --kind review --name review --template review --source review-changes`. Read the returned JSON, then fill in its `path` with scope, confidence, validation evidence, prioritized change requests, relevant resources, and follow-up work. Save it with `pst reports save --name <returned-name>` and keep the returned `reportId`. Repeated reviews receive numbered names and files, so they do not overwrite earlier reviews.

This is an independent code review. Create a `review` report, not a `change_request` report. The implementation agent owns the change request report.

### Final Action

Submit an explicit verdict before finishing. Do not change the ticket status directly.

- If there are no critical or minor findings, run:

  `pst pstdio-planner submit-review --workspace-id {{workspaceId}} --review-id {{reviewId}} --reviewed-head-sha {{headSha}} --review-report-id <report-id> --verdict passed --expected-revision {{revision}} --threads '[]'`

- If there are critical or minor findings, pass `--verdict changes_requested`. Set `--threads` to a JSON array. Each item must contain `severity`, `body`, and, when the finding is inline, `path`, `startLine`, `endLine`, and `side` (`base` or `head`). Suggestions may also be included.

The Planner validates the session, revision, commit, and report before it records the verdict.
