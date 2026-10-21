# Share Codex transport with session-owned threads

Proposed: 2026-09-29

Status: Accepted for PS-433 and PS-459; amended for PS-685 and PS-688, subject to release review.

## Decision

Use one local stdio app-server per installed provider generation and compatible execution environment, including the executable, Codex home/account, and base environment. Keep separate native thread owners for host sessions and projects. Working-directory changes use native turn fields and do not create another process. Codex owns execution and model history. The host owns scheduling, session status, attachments, checkpoints, and idle-resource retention. Public harness lifecycle disposal releases only the retiring project’s thread owners. Pause their goals, interrupt their current turns, and unsubscribe. Close the server after its final owner or history reader releases it. Whole-provider shutdown closes all transports and awaits child exit and stream cleanup, including unanswered requests.

On 2026-10-21, PS-865 replaced scope-lifetime idle retention with a shared host policy. Keep session resources while any connected client has an open tab, while native work or a host operation is active, or for 30 minutes after the last interaction. Inactive tabs and saved tabs on another page or mode count as open, including after an app reload. Client disconnect releases its interest; another client's interest still protects the session. Closing the last tab starts the same grace period.

Providers opt into per-session cleanup through `HarnessProvider.releaseSession`. The host serializes cleanup with startup and commands and retains runs until their `done` promise settles. A provider may decline when native work or delivery remains uncertain. Idle release must preserve stored history and must not interrupt autonomous work or terminate a remote machine. Reading saved history alone does not load native tools. A follow-up recreates resources from the saved provider session identity. Codex adoption follows the SDK/host release as a separate extension change; its native unload delay must not add a second retention period after the host has already waited 30 minutes.

Support Codex 0.157.0 and every newer release, and generate protocol types from 0.160.1. The Docker development image pins 0.160.1. Read native snapshots and normalize their item identities through the same mapper as live events. Resume recorded exec-created threads. Preserve host checkpoint metadata, including content removed by native compaction. The legacy checkpoint identity limit is recorded in [ADR 0062](0062-temporary-codex-history-identity-migration.md).

After lost delivery, retain a known thread ID and report disconnection. Read and resume that thread before another submission. An unresolved native turn blocks new execution. Never replay a mutation because its reply was lost. Stop interrupts only the owning native turn; an autonomous goal is also paused. Idle thread owners do not own a running host slot.

Thread start and cold resume pass cwd and host attribution through `shell_environment_policy.set`. Strip inherited server attribution and preserve unrelated shell policy. Always override both attribution keys; missing IDs use the isolated clearing described in [ADR 0073](0073-temporary-codex-shell-attribution-clearing.md). Loaded-thread attribution is stable. Reject reassignment to another host identity, including control requests. Warm resume is not a configuration update.

Thread creation alone starts no autonomous work. Keep its RPC pending through cancellation, claim the returned identity at its position in the stream, and check cancellation before any turn or goal mutation. A transport loss before the creation reply can leave only an idle thread; do not replay creation or dispatch work without its identity. After a delivered turn or goal mutation, wait for acknowledgement before thread-specific cancellation. If the native process never replies, that operation and scope retirement remain pending until transport recovery or whole-provider shutdown; killing the shared process to cancel one scope is forbidden.

Responses use globally unique request IDs. Notifications and server requests use explicit thread identity; unknown-thread and server-wide events have no default owner. A local protocol or publication failure stops only its native thread. Native turn identity comes from ordered events, with acknowledgements filling it only when no newer turn event exists. Cancellation waits for native turn start or terminal delivery before choosing an interrupt target. Read-only cancellation releases the local request without closing the transport.

A crash or native event-loop hang has a wider failure domain than a sleeping shell command. Transport loss disconnects all attached operations exactly once. Recreate the server, reconcile each recorded native history, and cold resume with attribution before new work. Never replay uncertain mutations. The POSIX server process group includes an npm launcher and its native child; cleanup reaches descendants even if the launcher exits first. No cross-account, cross-host daemon or core process broker is introduced.

Scope cleanup releases local ownership if its transport closes during stopping or unsubscribe. A cleanup error on a live transport retains ownership and remains an error. Confirmed transport loss already ends its native execution; do not send another cleanup mutation to a dead connection.

## Upstream maturity

The [official app-server documentation](https://learn.chatgpt.com/docs/app-server), checked on 2026-10-02, still labels the app-server command and WebSocket transport experimental and unsupported for production workloads. We choose local stdio despite that limit because it supplies one execution/history interface and native goal controls. This is a product adoption decision, not a claim of upstream production support. Experimental API access is needed for planning and question handling.

Release reviewers must consider this risk. Regenerating the checked-in types requires repeating identity, history, cancellation, goal, and compaction validation. Detection rejects releases older than the supported minimum rather than silently changing transport.

## Supported versions

The first release of this decision accepted only `^0.160.1`. For a 0.x version that means 0.160.x only. Codex ships a minor release every few days, so Codex was reported as not installed for anyone on 0.160.0 or 0.161.0 and later, including the current release.

On 2026-10-09 we generated the app-server types from 0.150.0 through 0.162.0 and compared every request, notification, and item type the harness uses with the checked-in 0.160.1 types:

- 0.159.0 to 0.160.1 are identical.
- 0.157.0 and 0.158.0 differ only in a documentation comment and one error code that the harness does not read.
- 0.155.0 and 0.156.x change thread, item, and tool output shapes. 0.150.0 also lacks async question items.
- 0.161.0 and 0.162.0 add optional request fields, item fields, and a message phase. The harness sends none of the new fields, does not read message phases or error codes, and ignores unknown item types.

A live probe started each release with the harness's app-server arguments. It created a thread, set, paused, read, and cleared a goal without the new optional `origin` field, and listed models. Every release from 0.150.0 to 0.162.0 passed. A real turn with a shell command and a mid-turn `turn/steer` completed on 0.157.0, 0.159.0, 0.160.1, and 0.162.0.

The minimum is therefore 0.157.0. Recorded 0.157.0 and latest traffic replays through the harness in its tests, and CI runs the harness against the installed minimum. See [native harnesses](../references/extensions/0016-native-harnesses.md#supported-cli-versions). There is no maximum. A maximum turns every Codex release into an outage, and the observed protocol changes were additive. When a release breaks a rule the harness relies on, raise the minimum or update the harness. Do not cap newer releases.

## Evidence and resource policy

The implementation report records real 0.159.3 runs, old exec-thread resume, warm worker reuse, restart, compaction, active goal controls, Docker dashboard checks, and independent failure probes. Focused regression tests cover item identity, uncertainty, cancellation, and scope disposal.

A three-turn smoke sample used the same model (`gpt-5.5`), medium effort, empty workspace, and prompt for exec and app-server. Warm app-server acknowledgement took about 8 ms; restart acknowledgement took about 124 ms. Native instruction/tool envelopes differed, so input totals and cache readings are reported separately. This small sample does not establish a general latency or cache improvement, or satisfy a representative production performance study.

A second three-turn sample used a shell workload (`pwd` and `printf`) with the same model, effort, workspace setup, and requested instructions. It records native cumulative and last-request token usage, worker restart, and compaction separately. Provider-owned instruction/tool envelopes still differ between exec and app-server. Treat these as transport observations, not a controlled estimate of a performance advantage.

A read-only idle worker measured 48,640 KiB RSS on macOS arm64, unchanged across 1.5 seconds. Loaded shell-workload workers are also measured in the report. These are individual process samples, not a memory bound. The original decision kept native owners until scope disposal; PS-865 supersedes that rule with the user-approved 30-minute policy above. This is a product resource lifetime, not a benchmark budget or test execution allowance. PS-685 measured ten short histories in one native server at 292288 KiB versus 1493008 KiB across ten servers after two shell turns. This single macOS sample is evidence of feasibility, not a product budget. PS-688 repeats shared and separate workloads through the harness and records active/idle memory and acknowledgement timing in its change request report. Do not infer a latency guarantee from those measurements.

## Alternatives and release rollback

Exec plus a rollout parser retains two evolving representations. A shared worker was originally rejected because it mixed process-wide attribution. PS-685 proved per-thread attribution on Codex 0.157.0 and 0.160.0, so PS-688 separates transport ownership from thread ownership. A machine-wide daemon would add supervision and account/host boundaries outside this task.

Hold release if native identity, unresolved-delivery protection, or worker cleanup fails on the supported version. If a shipped version regresses those rules, revert the Codex extension release and its CLI pin together, preserving native thread IDs and checkpoints. Do not add an automatic exec fallback or replay uncertain work. Native goals require the new runtime and must not be advertised by a rolled-back adapter.
