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

Scaffold the review report by running `pst reports write --kind review --name review --source review-changes`, then fill in `.pstdio/reports/review/report.md` with status, findings grouped by severity, test coverage, and conclusion. Save it by running `pst reports save --name review`.

### Final Action

If **no critical or minor issues** are found, mark the workspace attempt status as `reviewed` by running `pst workspaces set-status --status reviewed`. Otherwise mark it as `changes-requested` by running `pst workspaces set-status --status changes-requested`.
