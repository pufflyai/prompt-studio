# Adopt a session-owned Codex app-server runtime

Proposed: 2026-09-29

Status: Accepted for PS-433 and PS-459, subject to release review.

## Decision

Use one local stdio worker per project, session, and working directory. Keep it alive between turns. Codex owns execution and model history. The host owns scheduling, session status, attachments, and checkpoints. Public harness lifecycle disposal closes workers on extension retirement and host shutdown.

Support Codex `^0.160.1` and generate protocol types from 0.160.1. The Docker development image pins that version. Read native snapshots and normalize their item identities through the same mapper as live events. Resume recorded exec-created threads. Preserve host checkpoint metadata, including content removed by native compaction. The legacy checkpoint identity limit is recorded in [ADR 0062](0062-temporary-codex-history-identity-migration.md).

After lost delivery, retain a known thread ID and report disconnection. Read and resume that thread before another submission. An unresolved native turn blocks new execution. Never replay a mutation because its reply was lost. Stop interrupts the native turn; an autonomous goal is also paused. Idle workers do not own a running host slot.

## Upstream maturity

The [official app-server documentation](https://learn.chatgpt.com/docs/app-server), checked on 2026-10-02, still labels the app-server command and WebSocket transport experimental and unsupported for production workloads. We choose local stdio despite that limit because it supplies one execution/history interface and native goal controls. This is a product adoption decision, not a claim of upstream production support. Experimental API access is needed for planning and question handling.

Release reviewers must consider this risk. CLI upgrades require regenerating types and repeating identity, history, cancellation, goal, and compaction validation. Detection rejects unsupported CLI versions rather than silently changing transport.

## Evidence and resource policy

The implementation report records real 0.159.3 runs, old exec-thread resume, warm worker reuse, restart, compaction, active goal controls, Docker dashboard checks, and independent failure probes. Focused regression tests cover item identity, uncertainty, cancellation, and scope disposal.

A three-turn smoke sample used the same model (`gpt-5.5`), medium effort, empty workspace, and prompt for exec and app-server. Warm app-server acknowledgement took about 8 ms; restart acknowledgement took about 124 ms. Native instruction/tool envelopes differed, so input totals and cache readings are reported separately. This small sample does not establish a general latency or cache improvement, or satisfy a representative production performance study.

A second three-turn sample used a shell workload (`pwd` and `printf`) with the same model, effort, workspace setup, and requested instructions. It records native cumulative and last-request token usage, worker restart, and compaction separately. Provider-owned instruction/tool envelopes still differ between exec and app-server. Treat these as transport observations, not a controlled estimate of a performance advantage.

A read-only idle worker measured 48,640 KiB RSS on macOS arm64, unchanged across 1.5 seconds. Loaded shell-workload workers are also measured in the report. These are individual process samples, not a memory bound. Keep workers until their scope is disposed. Do not invent an idle timeout from these measurements. A future resource policy must measure realistic concurrent sessions first.

## Alternatives and release rollback

Exec plus a rollout parser retains two evolving representations. A shared worker mixes process-wide session attribution. A daemon adds supervision and connection ownership outside this task. None offers the same simple session ownership.

Hold release if native identity, unresolved-delivery protection, or worker cleanup fails on the supported version. If a shipped version regresses those rules, revert the Codex extension release and its CLI pin together, preserving native thread IDs and checkpoints. Do not add an automatic exec fallback or replay uncertain work. Native goals require the new runtime and must not be advertised by a rolled-back adapter.
