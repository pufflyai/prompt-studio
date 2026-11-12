Review the current workspace changes for ticket {{ticket}}.

Find implementation gaps, logic errors, incorrect assumptions, broken existing behavior, and missing or outdated tests.

For each finding:

- Cite the exact file and line.
- Classify it as critical, minor, or a suggestion.
- Explain the behavior and the required change.

Use the shipped `use-resource-activity` skill. Read the ticket's prior Activity and the implementation entry referenced by `read-attempt-history`. Publish one independent `review` entry on that ticket with the scope, confidence, validation evidence, prioritized findings, useful links and unfinished work. Include the exact implementation entry ID, workspace {{workspaceId}}, head {{headSha}}, revision {{revision}}, and your review session ID. Preserve the implementation base SHA. Set `verdict` to `passed` or `changes_requested`; keep the returned entry ID. Attach concrete evidence through Activity. Do not create a Reports outcome.

Submit a verdict before finishing. Do not change the ticket status.

- If there are no critical or minor findings, run:

  `pst pstdio-planner submit-review --workspace-id {{workspaceId}} --review-id {{reviewId}} --reviewed-head-sha {{headSha}} --review-activity-id <entry-id> --verdict passed --expected-revision {{revision}} --threads '[]'`

- If there are critical or minor findings, pass `--verdict changes_requested`. Publish the findings in the review Activity entry. If passing `--threads`, it must match those findings exactly. Each item must contain `severity`, `body`, and, when the finding is inline, `path`, `startLine`, `endLine`, and `side` (`base` or `head`). Suggestions may also be included.

The Planner validates the session, revision, commit, and Activity entry before it records the verdict.
