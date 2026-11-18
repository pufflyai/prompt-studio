# Temporary recovery for unobservable session metadata

Proposed: 2026-11-09
Status: Proposed; PS-157 implementation and qualification are in progress.

## Decision

Replace Sessions' two-second full snapshot loop with shared observations of the exact session, workspace link, selected workspace, native command state and committed extension records. Subscribe before reading. Workspace diff uses the existing bounded filesystem observation. Transcript patches, approvals and queue changes keep their existing stream and clocks.

## External limitation

Account Manager exposes peer presence through `devices()` but has no peer-presence subscription. A device's own heartbeat and account renewal do not announce other devices going offline. OpenCode's external command catalog has no complete change notification. Codex 0.162.0 sends thread notifications only after execution ownership claims a thread; a fresh or released idle thread has no passive observation API, and resuming it may continue a goal. Third-party harnesses may likewise omit native command observation. These sources cannot yet provide the intended complete event stream.

A failed remote queue read can return a saved read-only checkpoint. If the stream's initial queue read also fails, recovery on the same online owner produces no session mutation or presence transition to announce that reads work again. Removing the old full-snapshot timer exposed this gap in the real remote-owner browser flow.

## Limits

Share one two-second device recovery read per observed account service and authority, only while a remote session is observed. Compare device availability and fence results across account/origin changes. This preserves the existing availability refresh cadence without polling local sessions or transcripts. Release the owner and timer with the final observer.

An execution-availability hint refreshes its queue alongside availability, so an online owner replaces a cached read-only checkpoint. While that observed remote owner is online and its queue read fails or remains read-only, recover only the queue with a cancellable delay from two to thirty seconds. A successful editable queue snapshot or stream event cancels recovery; going offline or closing the watch cancels it too. A queue recovery hint reads no session, transcript, workspace, native command state or device presence. Coalescing and queue clocks retain a newer streamed queue over an older finite completion. Healthy and local queues have no timer.

For a harness that supplies command discovery but no observation, retain one observed-session command discovery hint every thirty seconds, matching the current OpenCode catalog cache lifetime. Providers with complete notifications have no timer. Hints read command presentation only; they do not read conversation snapshots or queues. The exact session owner stops the timer on replacement, hidden presentation or disposal. Host-native operations always publish a command-state hint, including controls that return no session parameter change.

For observed unclaimed Codex threads, share one immediate metadata baseline and one thirty-second recovery probe per session. Read goal state, metadata with `includeTurns: false`, and only the latest turn header (`limit: 1`, `itemsView: "notLoaded"`). Compare command-relevant metadata before invalidating command discovery. No transcript or queue is polled. Never resume/start a thread to observe it; native model discovery also uses metadata only. Stop recovery when the real execution owner claims native notifications, restart it on release/disconnect, and cancel it with the final observer. Protocol evidence: [pinned ThreadResumeParams](https://github.com/openai/codex/blob/rust-v0.162.0/codex-rs/app-server-protocol/schema/typescript/v2/ThreadResumeParams.ts), [ThreadReadParams](https://github.com/openai/codex/blob/rust-v0.162.0/codex-rs/app-server-protocol/schema/typescript/v2/ThreadReadParams.ts), and [ThreadTurnsListParams](https://github.com/openai/codex/blob/rust-v0.162.0/codex-rs/app-server-protocol/schema/typescript/v2/ThreadTurnsListParams.ts).

Stream failures use a separate cancellable recovery delay with exponential backoff from two to thirty seconds. Successful events reset it. Normal completion waits for a new run event. No recovery timer remains after the watch closes, and no timer starts a second child while the previous one is still running.

## Removal

Remove device recovery when Account Manager offers an authenticated peer-presence subscription. Remove failed remote queue recovery when the remote owner or transport publishes restored queue-read readiness independently of mutations. Remove Codex metadata recovery when a safe passive native subscription covers idle/released threads. Remove provider command recovery as each provider implements complete command-state observation; preserve operation acknowledgement hints and exact session events. Stream failure backoff remains transport recovery, not steady-state polling. Qualification must record each remaining probe's owner, scope, interval and reason.
