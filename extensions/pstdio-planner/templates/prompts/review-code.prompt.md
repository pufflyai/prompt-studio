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

Scaffold the review report by running `pst reports write --kind review --name review --template review --source review-changes`. Read the returned JSON, then fill in its `path` with scope, confidence, validation evidence, prioritized change requests, relevant resources, and follow-up work. Save it with `pst reports save --name <returned-name>`. Repeated reviews receive numbered names and files, so they do not overwrite earlier reviews.

This is an independent code review. Create a `review` report, not a `change_request` report. The implementation agent owns the change request report.

### Final Action

If **no critical or minor issues** are found, finish the review normally — the review passes when this session completes with the ticket still in review. Otherwise move the ticket back to implementation by running `pst tickets update --id {{ticket}} --status "In Progress"` so the findings get addressed.
