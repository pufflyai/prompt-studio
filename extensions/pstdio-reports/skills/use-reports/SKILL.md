---
name: use-reports
description: "Hand off task results between agents. Use when asked to produce a validation, review, test, or implementation report."
metadata:
  version: 0.0.1
---

# use-reports

Reports are handover artifacts between agents. Start one at the end of your task with:

`pst reports write --kind review`

Pass `--name <slug>` when the workspace may hold more than one report of the same kind, for example `--name post-merge-review`. Pass `--template <name>` to pick a non-default template.

Edit `.pstdio/reports/<name>/report.md` directly. Include validation evidence, a Confidence Score from `0/5` to `5/5`, and change requests when applicable. Drop supporting artifacts under `.pstdio/reports/<name>/files/`.

When done, persist your edits:

`pst reports save --name <name>`

To read another agent's report, open `.pstdio/reports/<name>/report.md`.

Use `pst reports delete --name <name>` to discard a draft created by mistake.
