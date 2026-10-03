# Harness commands and chat modes

Harnesses own native command meaning. Core provides discovery, dispatch, execution ownership, and shared presentation. A `/goal` command may expose a mode in one harness and only return a native reply in another.

## Public provider API

Declare `control: "command"` on a harness parameter when commands own its composer control. The composer omits its inline picker but keeps its native schema, default, and value. For example, `/plan` and its mode tag control a planning parameter. Other model parameters keep their normal controls. Core never guesses this relationship from a parameter or provider name.

The optional `HarnessProvider.getCommandState(ctx, input)` returns `commands`, `modes`, and `slashCommands`. Providers without this method continue ordinary prompting. Commands carry a name, description, and optional argument help. Discovery is help, not an invocation allowlist.

Discovery runs in new conversations too. `HarnessCommandDiscoveryContext` provides the selected workspace, model, and effective parameters before a session exists. Its host and native session IDs are absent until created. Discovery must not create a native conversation or submit a prompt. Operation preparation still requires a real host session through `HarnessCommandContext`.

Modes carry independent stable IDs, labels, descriptions, state text, and actions. An action can request one text argument. Mode IDs and action IDs belong to the selected qualified harness. Core does not infer modes from command text or store native mode state.

A command can declare `composer: { label, modeId?, reservedArguments? }` to tag an existing draft. Selecting it removes only the completion query. Submission sends the native command with that draft as its argument. `modeId` identifies native state that can confirm submission; without it, the UI must not invent a persistent mode. `reservedArguments` lists native action words that cannot represent a draft objective through this text command. `disabledReason` explains a current native restriction, including unsupported mode combinations.

Modes can declare `tagText` for a short native summary and `closeActionId` to select one of their advertised actions when the tag is closed. Without a declared close action, the UI only exposes the advertised controls in details. It must not choose an action by its spelling, label or position. Native mutations and inline argument edits preserve the unrelated composer draft.

A mode can declare `confirmation: { id, title, actionId, cancelLabel? }` when native state requires an explicit decision. The modal shows the mode description and the advertised action's label. Dismissing it does not invoke an action. Approving passes the native revision `id` as the action argument, so the provider can reject stale decisions through the same public operation path. Publish confirmation only for a native proposal, never infer it from assistant prose. The provider owns mode exit and any continuation started by approval.

`HarnessProvider.prepareOperation(ctx, input, operation)` validates and prepares an operation without performing its mutation. The operation is either `{ kind: "command", text }` or `{ kind: "mode-action", modeId, actionId, argument? }`. Preserve raw command text when the native interface accepts it.

The returned `execution` is `control` or `exclusive`. Controls can run during an existing turn and return a completed outcome. Exclusive operations reserve the existing host execution slot before invocation. They return either a completed outcome or a started `HarnessSession`. Acknowledgement is not completion: `session.done` must follow the native terminal event. Stop and the supplied abort signal must also cover startup. Invocation receives the host conversation sink and the same approval and question channels as prompts. Use the sink for native replies and errors, and keep using the channels after returning a started session. Idle controls read and extend saved history. During a turn, the host waits for accepted controls before saving and closing the conversation. Stopping the owner aborts controls and rejects pending channel requests. Providers must honor the supplied abort signal. Run parameter patches use the existing session settings owner.

The input provides the session and native IDs, current model and parameters, and resolved local or remote workspace. `ctx.projectId` selects the project scope. Keep provider protocols and parsing inside extensions. See the [source contract](../../../packages/pstdio-api-contracts/src/harness-commands.ts).

## Client tools

Chat completes native commands in an editor popover at a valid caret boundary, including after objective text. Type to filter and use arrow keys, Enter, Tab or pointer selection. Commands with `composer` metadata remove the slash query and tag the remaining draft; other commands insert plain command text. Escape closes the popover without changing the draft. Completion alone never runs a command. The old `#` reference-completion trigger is removed.

`client.sessions.getHarnessCommands(sessionId)` reads the current selected harness's descriptors and authoritative state. `client.sessions.invokeHarnessOperation(sessionId, operation, harnessId?)` invokes the same operation used by chat. Supplying the discovered qualified harness ID rejects a stale invocation after the harness changes.

`client.sessions.getDraftHarnessCommands({ project_id, agent, workspace_id?, model?, params? })` uses `POST /v1/sessions/harness-command-state` to discover commands before the first message. It resolves the same selected or default workspace and effective parameters as session creation. Starting a conversation with a native operation uses `client.sessions.create({ project_id, title, agent, operation, ... })`. Provide either `prompt` or `operation`, and do not attach files to a native operation. The host creates the session only on submission, then dispatches through the same operation owner used by existing sessions. The response includes `operation_result` for native replies. Rejected first operations return the created session as failed, so callers can show the error and retry in that conversation. A cancelled or disconnected operation keeps its authoritative status and any accepted native identity.

The authenticated endpoints are `GET` and `POST /v1/sessions/:id/harness-commands`. POST accepts `{ operation, harnessId? }` and returns `status: "completed" | "started"` with an optional native message. Started operations report subsequent status and conversation changes through existing session sync and streams. Exclusive operations reject conflicts rather than creating a second queue. Controls do not reserve another slot.

Send executes tagged input or leading native command text directly, without a separate command toggle. Unknown manually entered commands still reach the provider. Absolute paths and embedded slash text remain ordinary prompts, as does slash input for harnesses without native command support. Failed commands retain or restore their draft. Mode tags show short provider labels such as Goal and Plan; hover, keyboard focus and compact details expose the objective and native state. Reconnect reads provider state again.

## First-party mappings

| Harness | Commands and state |
| --- | --- |
| Codex | `/goal` uses native goal RPCs and autonomous turns. Pause, resume, edit, and clear act on native state. Stop pauses the goal and interrupts its current turn. `/plan` selects native collaboration mode in existing session parameters. A completed native proposal offers Approve and implement, which validates its revision and starts a normal turn in the same thread. `/compact` waits for native compaction completion. |
| Claude Code | `/goal` uses the CLI's native command handling and does not create a Codex Goal mode. `/plan` selects native planning permission mode. `/compact [instructions]` uses the streamed CLI command and exposes its terminal result. Other command text passes to the native CLI. |
| OpenCode | Native command discovery and invocation use its server API. `/compact` and `/summarize` invoke native summarization with the selected provider/model. Its Plan agent does not create a `/plan` alias. |

Codex requires version 0.159.3 within that minor version series. Its persistent worker is owned by project, host session, and working directory. Normal prompts and commands share that worker, native IDs, and live/history projection. Recovery reads native state before another mutation and never replays uncertain input. Native failed turns restore their errors. Saved attachment metadata and messages removed by compaction remain in the host checkpoint.

The checked native versions are Codex 0.159.3, Claude Code 2.1.287, and OpenCode 1.18.25. Regenerate the checked-in Codex types with `bun extensions/harness-codex/scripts/generate-protocol.ts` using the supported Codex executable.

Legacy history identity migration and Claude literal slash input need isolated temporary workarounds. Their limits and removal criteria are in [ADR 0053](../../adrs/0053-temporary-codex-history-identity-migration.md) and [ADR 0054](../../adrs/0054-temporary-claude-literal-slash-input.md). Question reply confirmation retains [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md).
