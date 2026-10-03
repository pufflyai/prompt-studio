# Harness command API

Harnesses own native command meaning. Core provides discovery, dispatch, execution ownership, and optional mode data. A `/goal` command may expose a mode in one harness and only return a native reply in another.

## Public provider API

The optional `HarnessProvider.getCommandState(ctx, input)` returns `commands`, `modes`, and `slashCommands`. Providers without this method continue ordinary prompting. Commands carry a name, description, and optional argument help. Discovery is help, not an invocation allowlist.

Modes carry independent stable IDs, labels, descriptions, state text, and actions. An action can request one text argument. Mode IDs and action IDs belong to the selected qualified harness. Core does not infer modes from command text or store native mode state.

`HarnessProvider.prepareOperation(ctx, input, operation)` validates and prepares an operation without performing its mutation. The operation is either `{ kind: "command", text }` or `{ kind: "mode-action", modeId, actionId, argument? }`. Preserve raw command text when the native interface accepts it.

The returned `execution` is `control` or `exclusive`. Controls can run during an existing turn and return a completed outcome. Exclusive operations reserve the existing host execution slot before invocation. They return either a completed outcome or a started `HarnessSession`. Acknowledgement is not completion: `session.done` must follow the native terminal event. Stop and the supplied abort signal must also cover startup. Invocation receives the host conversation sink and the same approval and question channels as prompts. Use the sink for native replies and errors, and keep using the channels after returning a started session. Idle controls read and extend saved history. During a turn, the host waits for accepted controls before saving and closing the conversation. Stopping the owner aborts controls and rejects pending channel requests. Providers must honor the supplied abort signal. Run parameter patches use the existing session settings owner.

The input provides the session and native IDs, current model and parameters, and resolved local or remote workspace. `ctx.projectId` selects the project scope. Keep provider protocols and parsing inside extensions. See the [source contract](../../../packages/pstdio-api-contracts/src/harness-commands.ts).

## Client tools

`client.sessions.getHarnessCommands(sessionId)` reads the current selected harness's descriptors and authoritative state. `client.sessions.invokeHarnessOperation(sessionId, operation, harnessId?)` invokes the selected harness operation. Supplying the discovered qualified harness ID rejects a stale invocation after the harness changes.

The authenticated endpoints are `GET` and `POST /v1/sessions/:id/harness-commands`. POST accepts `{ operation, harnessId? }` and returns `status: "completed" | "started"` with an optional native message. Started operations report subsequent status and conversation changes through existing session sync and streams. Exclusive operations reject conflicts rather than creating a second queue. Controls do not reserve another slot.
