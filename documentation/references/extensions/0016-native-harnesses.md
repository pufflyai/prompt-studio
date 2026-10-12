# First-party native harness commands

The harness extensions use the public command and mode contract introduced by [SDK PR #887](https://github.com/pufflyai/prompt-studio/pull/887). Merge and publish that SDK before updating their released dependency ranges. The SDK and shared composer ship separately from these provider implementations.

## Native mappings

| Harness | Commands and state |
| --- | --- |
| Codex | `/goal` uses native goal RPCs and autonomous turns. Pause, resume, edit, and clear act on native state. Stop pauses the goal and interrupts its current turn. `/plan` selects native collaboration mode in existing session parameters. A completed native proposal offers Approve and implement, which validates its revision and starts a normal turn in the same thread. `/compact` waits for native compaction completion. |
| Claude Code | `/goal` uses the CLI's native command handling and does not create a Codex Goal mode. `/plan` selects native planning permission mode. Commands retain the live question and approval channels, including native `AskUserQuestion` and `ExitPlanMode` requests. `/compact [instructions]` uses the streamed CLI command and exposes its terminal result. Other command text passes to the native CLI. |
| OpenCode | Native command discovery and invocation use its server API. `/compact` and `/summarize` invoke native summarization with the selected provider/model. Its Plan agent does not create a `/plan` alias. |

Each harness reports its CLI as not installed below its supported minimum. See [Supported CLI versions](#supported-cli-versions). The Codex persistent worker is owned by project, host session, and working directory. Normal prompts and commands share that worker, native IDs, and live/history projection. Recovery reads native state before another mutation and never replays uncertain input. Native failed turns restore their errors. Saved attachment metadata and messages removed by compaction remain in the host checkpoint.

Submitting `/goal <objective>` during an owned Codex operation replaces the native objective in the same thread. The current turn continues, and subsequent autonomous turns follow the new goal. Resume and Edit use the same live control path. The operation stays alive while the native mutation is pending, including when its current turn finishes before acknowledgement. If that owner finishes before invocation, no mutation is sent; submitting again uses the idle exclusive path. Explicit rejection releases the hold. Unknown delivery disconnects the worker without replay and preserves its native identity for readback.

Codex reports a status dot with native state: active is green, paused/blocked/usage or budget limited is amber, and complete is blue. It supplies Pause/Resume, Edit, and Clear icons. Unavailable status is neutral. Claude and OpenCode retain their native capabilities; the host does not infer a Goal mode or live replacement from a command spelling.

## Composer controls

The session composer shows the model menu only for harnesses that implement `listModels()`. An empty list still shows the menu, because model discovery can fail for a while. A harness without `listModels()`, such as a remote machine whose template picks the model, shows only the agent picker and runs without a model. When the agent cannot change either, as in an existing session, the composer shows neither.

`/v1/agents/info` returns each harness's `capabilities` and `supportsModels`. The `Attachments` capability marks a harness that accepts files. The host does not act on it yet; the composer and server will use it once the built-in harnesses declare it.

## Supported CLI versions

| Harness | Minimum | Why |
| --- | --- | --- |
| Codex | 0.157.0 | Oldest release whose app-server protocol matches every request, notification, and item the harness uses. Older releases change thread, item, and tool output shapes. The comparison and live checks are recorded in [ADR 0064](../../adrs/0064-codex-app-server-runtime.md#supported-versions). |
| Claude Code | 2.1.203 | First release that reports `background_tasks_changed` in stream JSON. Older releases end the run at the first result and kill the agent's background tasks. The flags, model discovery, and `AskUserQuestion` channel the harness uses work from 2.1.100. |
| OpenCode | 1.0.175 | First release that serves `/global/health` and `/question`. The harness finds its server through the health check and asks the agent's questions through the question API. Every other endpoint it calls works from 1.0.0. |

No harness has a maximum. The CLIs ship every one to three days, and the harnesses ignore events and items they do not know. A maximum would report the newest CLI as not installed.

Below the minimum, or when `--version` fails, detection returns a `reason` that names the found and required versions or the failed check.

Tests keep these versions supported:

- `src/supported-versions.test.ts` in each harness replays real CLI output from the minimum and the latest version through the harness. Codex runs a shell command and reads it back from history. Claude Code keeps a run open until its background task finishes and answers a question. OpenCode shows a turn that runs a shell command. Each test requires a recording at the current `MINIMUM_VERSION`.
- `src/installed-cli.test.ts` in each harness runs the harness against the installed CLI without a login: detection, model listing, and the Codex app-server thread and goal calls, the Claude Code session arguments, or the OpenCode server start and command API. It runs when `INSTALLED_CLI_TESTS=1`. Test and Build installs the minimum versions when a harness changes. Release readiness also installs the latest versions. The OpenCode test keeps OpenCode's data in temporary `XDG_*` folders.

To change a minimum, update `MINIMUM_VERSION` in the harness's `src/detection.ts`. Record new output with `bun scripts/record-cli-output.ts <executable>` at the new minimum and the latest version, and delete recordings older than the minimum. Codex and Claude Code need a signed-in CLI. OpenCode records on a free model without a login. The scripts remove machine paths and account details.

The current Codex protocol types come from 0.160.1. The original native integration checks used Codex 0.159.3, Claude Code 2.1.287, and OpenCode 1.18.25. Regenerate the checked-in Codex types with `bun extensions/harness-codex/scripts/generate-protocol.ts` using the supported Codex executable.

Legacy history identity migration and Claude literal slash input need isolated temporary workarounds. Their limits and removal criteria are in [ADR 0062](../../adrs/0062-temporary-codex-history-identity-migration.md) and [ADR 0063](../../adrs/0063-temporary-claude-literal-slash-input.md). Question reply confirmation retains [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md).
