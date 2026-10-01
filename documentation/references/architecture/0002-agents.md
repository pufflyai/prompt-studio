# Agents and extension harnesses

Prompt Studio delegates agent work to harness contributions from extensions. The host owns session lifecycle, workspace selection, queueing, permissions, and the complete conversation. Each harness owns its provider protocol and native transcript format.

## Discovery and identity

[The harness registry](../../../packages/pstdio-api/src/features/harnesses/harness-registry-service.ts) resolves project harnesses from the project's adopted extension catalog snapshot. Host-scoped discovery resolves installed host sources separately. Project handles are cached by catalog snapshot identity; a changed source path alone is not a new adopted project contract.

A harness has a qualified contribution ID, such as `pstdio.harness-claude-code.harness.claude-code`. HTTP callers use IDs returned by `client.agents.info({ project: projectId })`. CLI commands can resolve supported local aliases through their own selection flow. Do not assume a short CLI alias is valid for every SDK endpoint.

Executable availability is checked at runtime. Installing or enabling a harness extension does not install or authenticate the provider's coding-agent executable.

Core has no `agent_configs` table or agent CRUD service. Project/default harness choices and harness parameter defaults are separate from the installed extension source.

## API and CLI

The [agent routes](../../../packages/pstdio-api/src/features/agents/routes.ts) expose:

- Information about available harnesses.
- Executable availability checks.
- Model discovery for a qualified harness ID.

Use [agent CLI commands](../cli/0002-agents.md) to list harnesses and install enabled skills. Setup does not create a core agent configuration or make the first agent a global default.

## Session execution

1. Resolve the selected project's adopted harness contribution.
2. Resolve the session's workspace and execution target.
3. Apply the caller's model and harness parameters under the session selection rules.
4. Start or resume the harness with the complete conversation baseline and event sink.
5. Apply provider output to the host's conversation owner before publishing it.
6. Track the harness completion result and update lifecycle state through the session service.

Local harnesses receive a working directory. Remote-capable harnesses consume the workspace provider's execution target and may operate without a local path. A missing remote target must not silently fall back to the host's filesystem.

The harness's `done` and `stop` contracts own completion and cancellation. Do not infer completion from a rendered message part, a closed delivery buffer, or a frontend timeout.

When a harness cannot continue without the person, it asks through the host question channel on `HarnessStartInput.questions`. The host sets the session to `awaiting_input` while an ask is open and resolves the ask with the answer, so the same run finishes the turn. Waiting for the agent's own background work is not a question: that session is still working and stays `in_progress`. Status stays host-owned; see [session status lifecycle](0019-session-status-lifecycle.md).

### Persistent worker cleanup

`HarnessProvider.dispose(ctx)` is an optional public cleanup callback for workers and connections that stay alive across turns. Finishing a turn does not call it. The host calls it once for each context scope that used the provider. `ctx.projectId` identifies a project scope; an absent project ID identifies host-scoped discovery. A provider must release only resources from that scope.

Source reload and removal retire the affected provider handles. Disabling a provider in one project releases that project's resources even without another prompt. Rebuilding webview metadata keeps workers from unchanged provider modules. Replacement workers wait for earlier cleanup. Host shutdown awaits cleanup before closing storage. Retired handles reject new provider calls.

The callback must stop pending startup and active work, settle active runs' `done` promises, and wait for owned resources to terminate. It must preserve native conversation history. Providers may be used again in a later host lifecycle and must allow fresh resources then. A cleanup failure is reported and blocks replacement in that scope; it does not skip other providers' cleanup.

## Provider protocols

| Extension | Provider integration |
| --- | --- |
| [Claude Code](../../../extensions/harness-claude-code) | Child-process streaming and approvals; stdin stays open across turns so background tasks keep running, and the run ends when a turn finishes with no task left; resume uses the provider session identity and the complete saved baseline. |
| [OpenCode](../../../extensions/harness-open-code) | Provider HTTP/session API and transcript snapshots; the adapter converts model strings to provider-specific payloads. |
| [Codex](../../../extensions/harness-codex) | Provider events and native rollout reconciliation; provider-specific message formats stay in the harness. |

Provider source and tests define supported flags and transcript formats. Core must not parse a provider's private session file or duplicate its model conversion logic.

### Live question replies

A running harness can provide `HarnessSession.replyQuestion(response)`. The follow-up endpoint passes structured answers to that live callback without replacing the conversation owner, stopping the process, or starting another turn. A rejected callback returns a conversation error. Harnesses without the callback keep receiving `questionResponse` through their existing resume path.

`QuestionResponse.callId` identifies the question tool call when the client has that identity. The shared composer carries it through explicit submission. A matching host ask owns the reply before the native callback. Other call IDs remain eligible for the native callback. A stale reply cannot answer another host ask or replace its waiting run. Host asks stay open until their own answers arrive; plain text or answers without a call ID retain the all-open behavior. Each harness owns provider request IDs and maps ordered answers to its provider's question IDs.

Codex uses the [app-server stdio protocol](https://learn.chatgpt.com/docs/app-server), with experimental API access and `default_mode_request_user_input` enabled. Its harness translates `item/tool/requestUserInput` into the shared question tool and sends answers to the original server request. The protocol uses `serverRequest/resolved` for both replies and cleanup. The harness confirms the matching call ID and answers in the native transcript before reporting delivery, as described in [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md). Native turn completion owns the run result; the harness settles any reply confirmation and releases the process.

Reloading the browser keeps the live question channel open. Native rollout recovery matches questions by their call IDs, preserves the displayed question data, and restores readable answers. Cancelling or losing the process closes pending requests; a later reply reports that the request is unavailable. A process restart cannot restore an old stdio request. Normal follow-ups resume the native thread in a new process.

## Conversation ownership

The active `SessionConversation` owns the complete materialized message array. Harness patches update it before subscribers receive them. The bounded event log is only a delivery mechanism.

Resume initializes the conversation before accepting offset-based patches. Snapshot providers reconcile against the current owner. During recovery, the saved conversation wins disagreements and native history fills gaps. If a harness cannot pair the sources, the host continues from saved history; if the saved file is unreadable, it uses native history. The unchanged sources remain available for diagnostics. Reconciliation does not block resume.

See [sessions](0020-sessions.md) and [history ordering](../../lessons-learned/0008-follow-up-message-ordering-in-claude-code-sessions.md) for initialization, checkpoints, reconnects, and stale-run guards.

### OpenCode snapshot recovery

OpenCode owns provider messages and deletions. Each poll reads the current saved conversation and preserves host attachments and generated errors when their turn is identifiable. If repeated prompts lack stable IDs, the adapter retains uncertain saved turns separately and still publishes fresh provider output. It never assigns an attachment to a guessed owner. Retained IDs are disambiguated when they collide with positional provider IDs. Repeating the same snapshot does not add more copies.

This recovery logs one warning per running turn. It does not raise a reconciliation banner or abort OpenCode. Native provider messages still decide whether a turn completed or failed, so a retained error from an earlier turn cannot fail the current one. The same rule applies to start, resume, reattach, and question replies.

## Planner workflows

Planner owns ticket attempts and reviews. `run-attempt`, `run-review`, `submit-change-request`, and `submit-review` operate on explicit revisions and verdicts. A session finishing does not prove that implementation or review succeeded.

See [Planner attempts](../../../extensions/pstdio-planner/docs/attempts.md). Core session hooks must not recreate removed ticket or workspace attempt-status APIs.

## Rules

- Import harness contracts through the public SDK when authoring an extension.
- Keep provider IDs, session IDs, and Prompt Studio session IDs distinct.
- Keep provider credentials inside the declared connection or provider boundary.
- Install skills through the harness's declared layout; respect existing user-owned files.
- Route lifecycle changes through the session service so persistence, sync, and hooks agree.
