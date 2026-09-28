# Agents and extension harnesses

Prompt Studio delegates agent work to harness contributions from extensions. The host owns session lifecycle, workspace selection, queueing, permissions, and the complete conversation. Each harness owns its provider protocol and native transcript format.

## Discovery and identity

[The harness registry](../../packages/pstdio-api/src/features/harnesses/harness-registry-service.ts) resolves project harnesses from the project's adopted extension catalog snapshot. Host-scoped discovery resolves installed host sources separately. Project handles are cached by catalog snapshot identity; a changed source path alone is not a new adopted project contract.

A harness has a qualified contribution ID, such as `pstdio.harness-claude-code.harness.claude-code`. HTTP callers use IDs returned by `client.agents.info({ project: projectId })`. CLI commands can resolve supported local aliases through their own selection flow. Do not assume a short CLI alias is valid for every SDK endpoint.

Executable availability is checked at runtime. Installing or enabling a harness extension does not install or authenticate the provider's coding-agent executable.

Core has no `agent_configs` table or agent CRUD service. Project/default harness choices and harness parameter defaults are separate from the installed extension source.

## API and CLI

The [agent routes](../../packages/pstdio-api/src/features/agents/routes.ts) expose:

- Information about available harnesses.
- Executable availability checks.
- Model discovery for a qualified harness ID.

Use [agent CLI commands](0033-cli-agents.md) to list harnesses and install enabled skills. Setup does not create a core agent configuration or make the first agent a global default.

## Session execution

1. Resolve the selected project's adopted harness contribution.
2. Resolve the session's workspace and execution target.
3. Apply the caller's model and harness parameters under the session selection rules.
4. Start or resume the harness with the complete conversation baseline and event sink.
5. Apply provider output to the host's conversation owner before publishing it.
6. Track the harness completion result and update lifecycle state through the session service.

Local harnesses receive a working directory. Remote-capable harnesses consume the workspace provider's execution target and may operate without a local path. A missing remote target must not silently fall back to the host's filesystem.

The harness's `done` and `stop` contracts own completion and cancellation. Do not infer completion from a rendered message part, a closed delivery buffer, or a frontend timeout.

## Provider protocols

| Extension | Provider integration |
| --- | --- |
| [Claude Code](../../extensions/harness-claude-code) | Child-process streaming and approvals; resume uses the provider session identity and the complete saved baseline. |
| [OpenCode](../../extensions/harness-open-code) | Provider HTTP/session API and transcript snapshots; the adapter converts model strings to provider-specific payloads. |
| [Codex](../../extensions/harness-codex) | Provider events and native rollout reconciliation; provider-specific message formats stay in the harness. |

Provider source and tests define supported flags and transcript formats. Core must not parse a provider's private session file or duplicate its model conversion logic.

## Conversation ownership

The active `SessionConversation` owns the complete materialized message array. Harness patches update it before subscribers receive them. The bounded event log is only a delivery mechanism.

Resume initializes the conversation before accepting offset-based patches. Snapshot providers reconcile against the current owner. During recovery, the saved conversation wins disagreements and native history fills gaps. If a harness cannot pair the sources, the host continues from saved history; if the saved file is unreadable, it uses native history. The unchanged sources remain available for diagnostics. Reconciliation does not block resume.

See [sessions](0020-architecture-sessions.md) and [history ordering](../lessons-learned/0008-follow-up-message-ordering-in-claude-code-sessions.md) for initialization, checkpoints, reconnects, and stale-run guards.

### OpenCode snapshot recovery

OpenCode owns provider messages and deletions. Each poll reads the current saved conversation and preserves host attachments and generated errors when their turn is identifiable. If repeated prompts lack stable IDs, the adapter retains uncertain saved turns separately and still publishes fresh provider output. It never assigns an attachment to a guessed owner. Retained IDs are disambiguated when they collide with positional provider IDs. Repeating the same snapshot does not add more copies.

This recovery logs one warning per running turn. It does not raise a reconciliation banner or abort OpenCode. Native provider messages still decide whether a turn completed or failed, so a retained error from an earlier turn cannot fail the current one. The same rule applies to start, resume, reattach, and question replies.

## Planner workflows

Planner owns ticket attempts and reviews. `run-attempt`, `run-review`, `submit-change-request`, and `submit-review` operate on explicit revisions and verdicts. A session finishing does not prove that implementation or review succeeded.

See [Planner attempts](../../extensions/pstdio-planner/docs/attempts.md). Core session hooks must not recreate removed ticket or workspace attempt-status APIs.

## Rules

- Import harness contracts through the public SDK when authoring an extension.
- Keep provider IDs, session IDs, and Prompt Studio session IDs distinct.
- Keep provider credentials inside the declared connection or provider boundary.
- Install skills through the harness's declared layout; respect existing user-owned files.
- Route lifecycle changes through the session service so persistence, sync, and hooks agree.
