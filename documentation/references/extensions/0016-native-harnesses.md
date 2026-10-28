# First-party native harness commands

The harness extensions use the public command and mode contract introduced by [SDK PR #887](https://github.com/pufflyai/prompt-studio/pull/887). Merge and publish that SDK before updating their released dependency ranges. The SDK and shared composer ship separately from these provider implementations.

## Native mappings

### On-demand packages (0.46)

The planned API 0.3.0 adds optional `HarnessProvider.prepare(ctx)`. The host runs it
once per provider context before CLI detection, account actions, model discovery,
and session operations. Static capability discovery does not acquire packages.
Preparation runs outside the short availability-probe deadline. A failed
preparation remains retryable and does not hide healthy harnesses.

`prepareHarnessPackage(ctx, { command, minimumVersion, name, version, env? })`
probes a command array with `--version`. It returns `null` when that global CLI
is usable. Otherwise it calls the optional `ctx.packages.ensure({ name, version })`
capability and returns the acquired package's absolute path. Versions must be
exact. The host uses bundled Bun, skips install scripts, and keeps the package
under the contributing harness's cache directory. Acquisitions report progress
through the shared installation service. Package files stay outside extension
source and project folders.

The provider owns executable resolution within the returned package. Keep that
resolution shared by detection, account actions, models, and sessions. The
[temporary native package resolution decision](../../adrs/0110-temporary-native-cli-package-resolution.md)
describes the upstream package-layout limits.

### Commands

| Harness | Commands and state |
| --- | --- |
| Codex | `/goal` uses native goal RPCs and autonomous turns. Pause, resume, edit, and clear act on native state. Stop pauses the goal and interrupts its current turn. `/plan` selects native collaboration mode in existing session parameters. A completed native proposal offers Approve and implement, which validates its revision and starts a normal turn in the same thread. `/compact` waits for native compaction completion. |
| Claude Code | `/goal` uses the CLI's native command handling and does not create a Codex Goal mode. `/plan` selects native planning permission mode. Commands retain the live question and approval channels, including native `AskUserQuestion` and `ExitPlanMode` requests. `/compact [instructions]` uses the streamed CLI command and exposes its terminal result. Other command text passes to the native CLI. |
| OpenCode | Native command discovery and invocation use its server API. `/compact` and `/summarize` invoke native summarization with the selected provider/model. Its Plan agent does not create a `/plan` alias. |

Each harness first probes the global CLI. If it is missing or below the supported minimum, preparation acquires the harness’s exact pinned package in the host’s user cache. See [Supported CLI versions](#supported-cli-versions). Codex sessions share a local app-server within one installed provider generation and compatible execution environment. Each host session/project owns its native thread, controls, questions, and live/history projection. Cwd changes retain that owner. Per-thread shell configuration supplies attribution; a host-only session explicitly clears project attribution. Project disposal pauses goals and interrupts only that project’s threads. The final owner releases the process. Recovery reads native state before another mutation and never replays uncertain input. Native failed turns restore their errors. Saved attachment metadata and messages removed by compaction remain in the host checkpoint.

Submitting `/goal <objective>` during an owned Codex operation replaces the native objective in the same thread. The current turn continues, and subsequent autonomous turns follow the new goal. Resume and Edit use the same live control path. The operation stays alive while the native mutation is pending, including when its current turn finishes before acknowledgement. If that owner finishes before invocation, no mutation is sent; submitting again uses the idle exclusive path. Explicit rejection releases the hold. Unknown delivery disconnects the owning operation without replay and preserves its native identity for readback. A shared transport loss disconnects all attached operations; each reconciles its native history before new work. Local cancellation does not kill the shared server. Native hangs have a wider failure domain, and cancellation before acknowledgement waits for the native reply or transport recovery.

A follow-up can steer an already running Codex goal turn without starting a new turn. Stop and project disposal interrupt that observed turn after acknowledgement, without waiting for another start notification. Cancellation of a new turn still waits for its native start or terminal event.

Codex reports a status dot with native state: active is green, paused/blocked/usage or budget limited is amber, and complete is blue. It supplies Pause/Resume, Edit, and Clear icons. Unavailable status is neutral. Claude and OpenCode retain their native capabilities; the host does not infer a Goal mode or live replacement from a command spelling.

## Composer controls

The session composer shows the model menu only for harnesses that implement `listModels()`. An empty list still shows the menu, because model discovery can fail for a while. A harness without `listModels()`, such as a remote machine whose template picks the model, shows only the agent picker and runs without a model. When the agent cannot change either, as in an existing session, the composer shows neither.

`/v1/agents/info` returns each harness's `capabilities` and `supportsModels`. The `Attachments` capability marks a harness that accepts files. The host does not act on it yet; the composer and server will use it once the built-in harnesses declare it.

## Installation and sign-in

Provider extensions own CLI discovery and request pinned package acquisition through the host. Ordinary extension installation does not download a private CLI fallback. Preparation runs before detection, outside its short deadline, and the Installing Extensions widget tracks package acquisition. Detection, model discovery, sessions, and sign-in must use the same executable and native credential storage.

The unreleased extension API 0.3.0 adds optional `HarnessProvider.getAuthentication(ctx, { model })` and `authenticate(ctx, input, channel)`. Account state describes the selected model provider as `signed_in`, `signed_out`, `not_required`, or `unknown`, plus a catalog of providers and their native sign-in methods. Discovery never starts sign-in or returns credentials. Account status uses `GET /v1/agents/{agentId}/authentication`, separately from cached CLI availability.

When no harness is available, the session background shows a warning and a link to Extensions, and hides the chat input. This checks all harnesses, rather than only the selected one. When the selected available harness reports that it is signed out, the background shows a sign-in empty state with a **Sign in** button. The input remains editable, but messages cannot be sent until sign-in is confirmed.

`/login` and `/logout` are local chat commands. They appear before a conversation or model is ready and never become agent prompts. The dedicated authenticated WebSocket at `/v1/agents/authentication` carries browser links, provider choices, and masked input. Replies stay out of command lifecycle events and conversation history. The shared `chooseHarnessAuthentication` SDK helper selects a native provider and method, defaulting to the selected model provider. Environment and configuration credentials are not removable.

Codex offers ChatGPT device authentication and API-key login through its native app-server. Claude offers subscription or Console login through the native CLI, with its browser link and code input shown in the session background. OpenCode discovers provider methods and plugin fields through its server API and saves credentials through native auth endpoints. Local and anonymous providers do not block sending. A credential for one provider does not authorize another. Browser links open on the dashboard device, including when the harness runs in Docker or remotely.

Closing the channel cancels the account flow. Disabling or retiring the extension also cancels its flows and waits for worker cleanup. Completion refreshes account state and model queries. Native status, rather than a successful login action alone, determines readiness. Conversation history remains readable while setup is required.

Probe failures remain unknown rather than reporting a signed-out account. See the [Codex CLI reference](https://developers.openai.com/codex/cli/reference/), [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference), and [OpenCode CLI reference](https://opencode.ai/docs/cli/).

SDK/host support must ship before released extensions rely on `getAuthentication` and `authenticate`. An older host does not call these optional methods, so it cannot show the sign-in action.

## Supported CLI versions

| Harness | Minimum | Why |
| --- | --- | --- |
| Codex | 0.157.0 | Oldest release whose app-server protocol matches every request, notification, and item the harness uses. Older releases change thread, item, and tool output shapes. The comparison and live checks are recorded in [ADR 0064](../../adrs/0064-codex-app-server-runtime.md#supported-versions). |
| Claude Code | 2.1.203 | First release that reports `background_tasks_changed` in stream JSON. Older releases end the run at the first result and kill the agent's background tasks. The flags, model discovery, and `AskUserQuestion` channel the harness uses work from 2.1.100. |
| OpenCode | 1.0.175 | First release that serves `/global/health` and `/question`. The harness finds its server through the health check and asks the agent's questions through the question API. Every other endpoint it calls works from 1.0.0. |

No harness has a maximum. The CLIs ship every one to three days, and the harnesses ignore events and items they do not know. A maximum would report the newest CLI as not installed.

Below the minimum, or when `--version` fails, detection returns a `reason` that names the found and required versions or the failed check.

Tests keep these versions supported:

- `src/supported-versions.p0.test.ts` in each harness replays real CLI output from the minimum and the latest version through the harness. Codex runs a shell command and reads it back from history. Claude Code keeps a run open until its background task finishes and answers a question. OpenCode shows a turn that runs a shell command. Each test requires a recording at the current `MINIMUM_VERSION`.
- `src/installed-cli.p0.test.ts` in each harness runs the harness against the installed CLI without a login: detection, model listing, and the Codex app-server thread and goal calls, the Claude Code session arguments, or the OpenCode server start and command API. It runs when `INSTALLED_CLI_TESTS=1`. Test and Build installs the minimum versions when a harness changes. Every release and nightly also installs the latest versions before publishing. The OpenCode test keeps OpenCode's data in temporary `XDG_*` folders.

To change a minimum, update `MINIMUM_VERSION` in the harness's `src/detection.ts`. Record new output with `bun scripts/record-cli-output.ts <executable>` at the new minimum and the latest version, and delete recordings older than the minimum. Codex and Claude Code need a signed-in CLI. OpenCode records on a free model without a login. The scripts remove machine paths and account details.

The current Codex protocol types come from 0.160.1. The original native integration checks used Codex 0.159.3, Claude Code 2.1.287, and OpenCode 1.18.25. Regenerate the checked-in Codex types with `bun extensions/harness-codex/scripts/generate-protocol.ts` using the supported Codex executable.

Legacy history identity migration and Claude literal slash input need isolated temporary workarounds. Their limits and removal criteria are in [ADR 0062](../../adrs/0062-temporary-codex-history-identity-migration.md) and [ADR 0063](../../adrs/0063-temporary-claude-literal-slash-input.md). Host-only attribution clearing retains [ADR 0073](../../adrs/0073-temporary-codex-shell-attribution-clearing.md). Question reply confirmation retains [ADR 0052](../../adrs/0052-temporary-codex-question-delivery-confirmation.md).
