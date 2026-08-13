# pstdio Reports

Workspace-scoped reports for agent handoffs.

After implementation, use `pst reports write --kind change_request --name change_request --template change-request`. Edit the returned `path`, add supporting files under the returned `filesPath`, then run `pst reports save --name <returned-name>`.

When reviewing code, use `pst reports write --kind review --name review --template review` for the independent review of a change request.

There is no default report template. Omitting `--template` lists the available templates: `change-request` and `review`.

Report creation never overwrites an existing file. Reusing a name creates a numbered report, for example `review_01` at `.pstdio/reports/review/report_01.md`, with artifacts under `.pstdio/reports/review/files_01/`.
