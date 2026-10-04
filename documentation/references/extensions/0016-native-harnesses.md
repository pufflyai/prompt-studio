# First-party native harness commands

The harness extensions use the public command and mode contract introduced by [SDK PR #887](https://github.com/pufflyai/prompt-studio/pull/887). Merge and publish that SDK before updating their released dependency ranges. The SDK and shared composer ship separately from these provider implementations.

## Native mappings

| Harness | Commands and state |
| --- | --- |
| Codex | `/goal` uses native goal RPCs and autonomous turns. Pause, resume, edit, and clear act on native state. Stop pauses the goal and interrupts its current turn. `/plan` selects native collaboration mode in existing session parameters. A completed native proposal offers Approve and implement, which validates its revision and starts a normal turn in the same thread. `/compact` waits for native compaction completion. |
| Claude Code | `/goal` uses the CLI's native command handling and does not create a Codex Goal mode. `/plan` selects native planning permission mode. Commands retain the live question and approval channels, including native `AskUserQuestion` and `ExitPlanMode` requests. `/compact [instructions]` uses the streamed CLI command and exposes its terminal result. Other command text passes to the native CLI. |
| OpenCode | Native command discovery and invocation use its server API. `/compact` and `/summarize` invoke native summarization with the selected provider/model. Its Plan agent does not create a `/plan` alias. |

Codex requires version 0.159.3 within that minor version series. Its persistent worker is owned by project, host session, and working directory. Normal prompts and commands share that worker, native IDs, and live/history projection. Recovery reads native state before another mutation and never replays uncertain input. Native failed turns restore their errors. Saved attachment metadata and messages removed by compaction remain in the host checkpoint.

The checked native versions are Codex 0.159.3, Claude Code 2.1.287, and OpenCode 1.18.25. Regenerate the checked-in Codex types with `bun extensions/harness-codex/scripts/generate-protocol.ts` using the supported Codex executable.

Legacy history identity migration and Claude literal slash input need isolated temporary workarounds. Their limits and removal criteria are in [ADR 0053](../../adrs/0053-temporary-codex-history-identity-migration.md) and [ADR 0054](../../adrs/0054-temporary-claude-literal-slash-input.md). Question reply confirmation retains [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md).
