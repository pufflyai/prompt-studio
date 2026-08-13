---
name: use-reports
description: "Hand off task results between agents. Use when asked to produce a change request, validation, review, test, or implementation report."
metadata:
  version: 0.0.4
---

# use-reports

Reports are handover artifacts between agents.

After implementing a change, create a change request report with:

`pst reports write --kind change_request --name change_request --template change-request`

Fill every section. Explain why the change is needed, motivate concrete implementation decisions, link relevant resources, and explain how to validate the work. Always state anything left undone, any shortcuts taken, and any blockers encountered. Write `None` when a required disclosure has nothing to report.

When reviewing code, create a review report for the independent review of the change request:

`pst reports write --kind review --name review --template review`

Do not create a review report for your own implementation. Do not create a change request report for a code review.

Always pass `--template`. There is no default report template. The available templates are `change-request` and `review`.

Read the JSON returned by `reports write`. Edit its `path` and place supporting artifacts under its `filesPath`. Reusing a name never overwrites an existing report: later reports use numbered names and files such as `review_01` and `.pstdio/reports/review/report_01.md`. Review reports should include findings and requested changes when applicable.

When done, persist your edits with the returned `name`:

`pst reports save --name <name>`

To read another agent's report, open the `path` returned when that report was created.

Use `pst reports delete --name <name>` to discard a draft created by mistake.
