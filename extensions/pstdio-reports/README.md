# Agent Reports

Reports lets agents hand work to each other as written reports: a change request after an implementation, and a review of that change.

Each report belongs to a workspace. Planner's [managed attempts](../pstdio-planner/docs/0002-attempts.md) use reports to pass work from the implementing agent to the reviewer.

## Install

Agent Reports is optional. Open **Extensions** in the navigation footer, find **Agent Reports** under **Available**, and select **Install**. You can also run:

```sh
pst extensions add pstdio-reports
```

Reports gives agents a `use-reports` skill that explains when and how to write each report. Reports need a project opened from a local folder.

## Write a report

A report starts as a local Markdown file. The agent fills it in, then saves it:

1. Create the report from a template. After an implementation, run:

   ```sh
   pst reports write --kind change_request --name change_request --template change-request
   ```

   For an independent review of a change request, run:

   ```sh
   pst reports write --kind review --name review --template review
   ```

2. Edit the file at the `path` that the command returns. Put supporting files, such as screenshots or logs, in the returned `filesPath` folder.
3. Save the report with the returned name:

   ```sh
   pst reports save --name <returned-name>
   ```

There is no default template. If you leave out `--template`, the command fails and lists the templates you can use: `change-request` and `review`. Edit the templates in **Settings → Project → Templates**.

Writing a report never overwrites an existing one. When a name is taken, the next report gets a number. For example, a second `review` report is named `review_01`. Its file is `.pstdio/extension-storage/pstdio.pstdio-reports/reports/review/report_01.md`, and its supporting files go in `.pstdio/extension-storage/pstdio.pstdio-reports/reports/review/files_01/`.

## Commands

```sh
pst reports write [--workspace <workspace>] [--kind <kind>] [--name <name>] --template <template> [--source <source>]
pst reports read --id <report-id-or-number>
pst reports save [--workspace <workspace>] [--name <name>]
pst reports delete --name <name> [--workspace <workspace>]
```

`--workspace` takes a workspace ID such as `WS-19`. Without it, the command uses the agent's current workspace, or the project folder.

`save` needs `--name` when the workspace has no report or more than one. Use `delete` to discard a report that was created by mistake.

Core assigns report numbers such as `RP-12`. Reports reads the current number from core instead of storing a copy. After devices sync offline reports, a number can change; its old number remains an alias. `read --id RP-12` accepts current numbers and aliases. When a number matches several reports, it returns all of them with their current numbers. Use the stable report ID to read one report.

The same commands are also available under the extension's own name:

```sh
pst pstdio-reports reports write [options]
pst pstdio-reports reports read --id <report-id>
pst pstdio-reports reports save [options]
pst pstdio-reports reports delete --name <name> [options]
```
