# pstdio Reports

Workspace-scoped reports for agent handoffs.

## Commands

```sh
pst reports write [--workspace <id>] [--kind <kind>] [--name <name>] --template <template> [--source <source>]
pst reports read --id <report-id>
pst reports save [--workspace <id>] [--name <name>]
pst reports delete [--workspace <id>] [--name <name>]
```

The same commands are available under the extension namespace:

```sh
pst pstdio-reports reports write [options]
pst pstdio-reports reports read --id <report-id>
pst pstdio-reports reports save [options]
pst pstdio-reports reports delete [options]
```

After implementation, use `pst reports write --kind change_request --name change_request --template change-request`. Edit the returned `path`, add supporting files under the returned `filesPath`, then run `pst reports save --name <returned-name>`.

When reviewing code, use `pst reports write --kind review --name review --template review` for the independent review of a change request.

There is no default report template. Omitting `--template` lists the available templates: `change-request` and `review`.

Report creation never overwrites an existing file. Reusing a name creates a numbered report, for example `review_01` at `.pstdio/reports/review/report_01.md`, with artifacts under `.pstdio/reports/review/files_01/`.
