Review the current workspace changes for ticket {{ticket}}.

Find implementation gaps, logic errors, incorrect assumptions, broken existing behavior, and missing or outdated tests.

For each finding:

- Cite the exact file and line.
- Classify it as critical, minor, or a suggestion.
- Explain the behavior and the required change.

Create the report with `pst reports write --kind review --name review --template review --source review-changes`. Read the returned JSON. Fill its `path` with the review scope, confidence, validation evidence, prioritized findings, useful links, and follow-up work. Save it with `pst reports save --name <returned-name>` and keep the returned `reportId`.

Repeated reviews get numbered names and files, so earlier reviews remain unchanged. This is an independent code review. Create a `review` report, not a `change_request` report.

Submit a verdict before finishing. Do not change the ticket status.

- If there are no critical or minor findings, run:

  `pst pstdio-planner submit-review --workspace-id {{workspaceId}} --review-id {{reviewId}} --reviewed-head-sha {{headSha}} --review-report-id <report-id> --verdict passed --expected-revision {{revision}} --threads '[]'`

- If there are critical or minor findings, pass `--verdict changes_requested`. Set `--threads` to a JSON array. Each item must contain `severity`, `body`, and, when the finding is inline, `path`, `startLine`, `endLine`, and `side` (`base` or `head`). Suggestions may also be included.

The Planner validates the session, revision, commit, and report before it records the verdict.
