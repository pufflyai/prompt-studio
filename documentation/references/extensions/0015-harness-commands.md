# Harness commands and chat modes

Harnesses own native command meaning. Core provides discovery, dispatch, execution ownership, and shared presentation. A `/goal` command may expose a mode in one harness and only return a native reply in another.

## Public provider API

The optional `HarnessProvider.getCommandState(ctx, input)` returns `commands`, `modes`, and `slashCommands`. Providers without this method continue ordinary prompting. Commands carry a name, description, and optional argument help. Discovery is help, not an invocation allowlist.

Modes carry independent stable IDs, labels, descriptions, state text, and actions. An action can request one text argument. Mode IDs and action IDs belong to the selected qualified harness. Core does not infer modes from command text or store native mode state.

`HarnessProvider.prepareOperation(ctx, input, operation)` validates and prepares an operation without performing its mutation. The operation is either `{ kind: "command", text }` or `{ kind: "mode-action", modeId, actionId, argument? }`. Preserve raw command text when the native interface accepts it.

The returned `execution` is `control` or `exclusive`. Controls can run during an existing turn and return a completed outcome. Exclusive operations reserve the existing host execution slot before invocation. They return either a completed outcome or a started `HarnessSession`. Acknowledgement is not completion: `session.done` must follow the native terminal event. Stop and the supplied abort signal must also cover startup. Invocation receives the host conversation sink and the same approval and question channels as prompts. Use the sink for native replies and errors, and keep using the channels after returning a started session. Idle controls read and extend saved history. During a turn, the host waits for accepted controls before saving and closing the conversation. Stopping the owner aborts controls and rejects pending channel requests. Providers must honor the supplied abort signal. Run parameter patches use the existing session settings owner.

The input provides the session and native IDs, current model and parameters, and resolved local or remote workspace. `ctx.projectId` selects the project scope. Keep provider protocols and parsing inside extensions. See the [source contract](../../../packages/pstdio-api-contracts/src/harness-commands.ts).

## Client tools

`client.sessions.getHarnessCommands(sessionId)` reads the current selected harness's descriptors and authoritative state. `client.sessions.invokeHarnessOperation(sessionId, operation, harnessId?)` invokes the same operation used by chat. Supplying the discovered qualified harness ID rejects a stale invocation after the harness changes.

The authenticated endpoints are `GET` and `POST /v1/sessions/:id/harness-commands`. POST accepts `{ operation, harnessId? }` and returns `status: "completed" | "started"` with an optional native message. Started operations report subsequent status and conversation changes through existing session sync and streams. Exclusive operations reject conflicts rather than creating a second queue. Controls do not reserve another slot.

Chat completion inserts a command into the composer; submission executes it. Unknown manually entered commands still reach the provider. The composer can send slash text as an ordinary message. Absolute paths and embedded slash text remain ordinary prompts. Failed commands retain or restore their draft. Each mode renders its own state and native actions. Reconnect reads provider state again.

## First-party mappings

| Harness | Commands and state |
| --- | --- |
| Codex | `/goal` uses native goal RPCs and autonomous turns. Pause, resume, edit, and clear act on native state. Stop pauses the goal and interrupts its current turn. `/plan` selects native collaboration mode in existing session parameters. `/compact` waits for native compaction completion. |
| Claude Code | `/goal` uses the CLI's native command handling and does not create a Codex Goal mode. `/plan` selects native planning permission mode. `/compact [instructions]` uses the streamed CLI command and exposes its terminal result. Other command text passes to the native CLI. |
| OpenCode | Native command discovery and invocation use its server API. `/compact` and `/summarize` invoke native summarization with the selected provider/model. Its Plan agent does not create a `/plan` alias. |

Codex requires version 0.159.3 within that minor version series. Its persistent worker is owned by project, host session, and working directory. Normal prompts and commands share that worker, native IDs, and live/history projection. Recovery reads native state before another mutation and never replays uncertain input. Native failed turns restore their errors. Saved attachment metadata and messages removed by compaction remain in the host checkpoint.

The checked native versions are Codex 0.159.3, Claude Code 2.1.287, and OpenCode 1.18.25. Regenerate the checked-in Codex types with `bun extensions/harness-codex/scripts/generate-protocol.ts` using the supported Codex executable.

Legacy history identity migration and Claude literal slash input need isolated temporary workarounds. Their limits and removal criteria are in [ADR 0053](../../adrs/0053-temporary-codex-history-identity-migration.md) and [ADR 0054](../../adrs/0054-temporary-claude-literal-slash-input.md). Question reply confirmation retains [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md).
