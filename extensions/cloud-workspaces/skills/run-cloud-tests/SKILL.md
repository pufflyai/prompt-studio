---
name: run-cloud-tests
description: Run repository tests in an isolated workspace on the deployed PocketCoder controller, collect logs, and check automatic shutdown. Use for cloud test runs against a branch or working tree.
---

Cloud Workspaces uses the private Remote Testing companion (`pocketcoder.remote-testing`) for source upload, run collection, and cleanup. Run `pst` from the linked local project. Operator connections and Google authentication stay on the host.

Check setup with `pst pocketcoder.remote-testing status`. If unavailable, inspect the reported problem. Configure host connections through Prompt Studio connection settings. Never copy operator keys, Google credentials, runtime tokens, or environment files into extension assets or cloud source. Files ignored by Git are omitted from uploads; inspect `git status --short` for accidentally tracked secrets before uploading.

Start a run with an explicit repository path and test command:

```sh
pst pocketcoder.remote-testing run --path /absolute/repository --command "bun install --frozen-lockfile && bun run test:unit" --timeout-minutes 30 --wait false
```

Choose a command that actually exists in that repository. The example does not select a suite for you. `--path` uploads the current working tree, including non-ignored new files. Add `--ref <commit>` for an exact committed snapshot. Branch runs use the approved test runtime; do not invent a template name for each agent. `--branch-template true` is available when an immutable snapshot template is needed.

Each run starts a fresh workspace by default. To reuse one you intentionally kept, pass `--environment <environmentId>`. `--wait false` still waits for provisioning and request submission before returning IDs; it skips waiting for the test result. Save the returned `runId` and `environmentId`, then collect the result:

```sh
pst pocketcoder.remote-testing runs show --run-id <runId>
```

Report `status`, `exitCode`, tested revision or dirty snapshot, command, and `logPath`. Read failures from the full local log; the returned tail can omit the cause. Check the workspace in Cloud Workspaces or `pst pocketcoder.remote-testing environments list`. The collector stops test workspaces after saving the result, including failures. Do not use `--keep-environment true` unless the task needs it.

The default runner uploads a source snapshot without the original Git history. It is Linux amd64 and has no Docker daemon. It cannot run `test:review`, which needs the comparison base and service integrations. Passing focused cloud tests does not satisfy that review gate. Browser suites may need their repository-pinned Playwright browser installed as part of the command. Do not silently skip required suites when a prerequisite is missing.

For interrupted or unwanted runs, use `pst pocketcoder.remote-testing runs cancel --run-id <runId>`. Stop an owned leftover workspace with `pst pocketcoder.remote-testing environments stop --environment <environmentId>`. Do not stop another agent's workspace or use `--all` during concurrent work.
