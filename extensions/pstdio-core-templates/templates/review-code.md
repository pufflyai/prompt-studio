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

Scaffold the review file by running `pstdio templates write --name "code-review" --target ".pstdio/tickets/{{ticket}}/review.md"`, then fill in the sections (status, findings grouped by severity, test coverage, conclusion).

### Final Action

If **no critical or minor issues** are found, mark the workspace attempt status as `reviewed`. Otherwise mark it as `changes-requested`.
