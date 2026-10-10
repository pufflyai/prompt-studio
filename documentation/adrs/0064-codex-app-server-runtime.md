# Adopt a session-owned Codex app-server runtime

Proposed: 2026-09-29

Status: Accepted for PS-433 and PS-459, subject to release review.

## Decision

Use one local stdio worker per project, session, and working directory. Keep it alive between turns. Codex owns execution and model history. The host owns scheduling, session status, attachments, and checkpoints. Public harness lifecycle disposal closes workers on extension retirement and host shutdown.

Support Codex 0.157.0 and every newer release, and generate protocol types from 0.160.1. The Docker development image pins 0.160.1. Read native snapshots and normalize their item identities through the same mapper as live events. Resume recorded exec-created threads. Preserve host checkpoint metadata, including content removed by native compaction. The legacy checkpoint identity limit is recorded in [ADR 0062](0062-temporary-codex-history-identity-migration.md).

After lost delivery, retain a known thread ID and report disconnection. Read and resume that thread before another submission. An unresolved native turn blocks new execution. Never replay a mutation because its reply was lost. Stop interrupts the native turn; an autonomous goal is also paused. Idle workers do not own a running host slot.

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

A read-only idle worker measured 48,640 KiB RSS on macOS arm64, unchanged across 1.5 seconds. Loaded shell-workload workers are also measured in the report. These are individual process samples, not a memory bound. Keep workers until their scope is disposed. Do not invent an idle timeout from these measurements. A future resource policy must measure realistic concurrent sessions first.

## Alternatives and release rollback

Exec plus a rollout parser retains two evolving representations. A shared worker mixes process-wide session attribution. A daemon adds supervision and connection ownership outside this task. None offers the same simple session ownership.

Hold release if native identity, unresolved-delivery protection, or worker cleanup fails on the supported version. If a shipped version regresses those rules, revert the Codex extension release and its CLI pin together, preserving native thread IDs and checkpoints. Do not add an automatic exec fallback or replay uncertain work. Native goals require the new runtime and must not be advertised by a rolled-back adapter.
