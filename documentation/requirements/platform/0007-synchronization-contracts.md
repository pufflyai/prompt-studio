# PRD: Synchronization contracts v0.1

Status: Proposed. PS-744 defines protocol evidence for PS-735. It does not ship cloud synchronization or complete the parent ticket.

## Purpose

A person can save work locally, work offline, and reconnect without losing changes.
Tools share platform storage and recovery rather than building their own replication.
This fits the [mission](../../../MISSION.md): extensions own their data and meaningful
edits; the platform owns durable storage, synchronization, and conflict preservation.
People, agents, and extension commands must use the same eventual public operations.

## Product boundary

One owner can use many local environments against one cloud-backed workbench.
Download all workbench records, published extension packages, and assets. A local
save can succeed without relay access. Sessions, processes, terminals, repositories,
working directories, and unpublished extension edits stay local. Automations target
one explicit environment and never move automatically.

An extension mutation can change several records and assets within one workbench.
Save it locally as a unit. Accept or preserve it as a unit remotely. Referenced bytes
must be complete before records become visible. Cross-extension and cross-workbench
transactions are outside v0.1.

Normal reads show the first relay-accepted state with conflict metadata. Keep every
unresolved alternative and its bytes. Receiving remote state must preserve ongoing
local edits. Compatible shared text/list operations and independent map keys can
merge. Arbitrary JSON replacements, competing map keys, and binary replacements
must not be guessed compatible.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| Saved locally | The complete mutation and necessary local bytes are durable. |
| Pending | The mutation waits for connection, bytes, or an unresolved ancestor. |
| Synchronized | The relay has durably accepted this operation and issued a receipt. |
| Conflict | The accepted state stays visible and the complete alternative is retained. |

An unsupported peer gives an actionable update result. It does not discard queued
work, alter its payload, or pretend that it synchronized.

## Resolution and recovery

Inspection exposes accepted state, alternatives, input revisions, and dependency
ancestry. A resolution names its captured branch and exact current input/conflict
revisions. A stale proposal preserves all work and must be recomputed. A late third
environment cannot erase existing work by submitting an older resolution.

Domain handlers run only in authorized local runtimes. Automatic proposals pin the
published immutable extension revision and handler ID. Development overrides cannot
select the automatic handler. The relay validates authorization, publication and
revision checks; it never executes extension code. Handler failure or unavailability
keeps the conflict. Explicit human and agent resolutions remain available.

Restoring an older relay preserves stable workbench identities. Returning clients
first recover newer accepted work and its ancestry, then submit pending work.
Compaction cannot make a missing receipt look like restore loss. Keep receipt
identity, fingerprints, captured ancestry, tombstones, checkpoint lineage, and
recoverable payloads. Production retention and compaction belong to later work.
Content recovery cannot restore account credentials or grants.

## Acceptance and evidence

The executable contract is [the private package](../../../packages/pstdio-sync-contracts/package.json).
The [reference](../../references/architecture/0026-synchronization-contracts.md)
defines operations, ownership and validation commands.

- Validate strict versioned envelopes through the same package export in local and relay consumers.
- Distinguish duplicates from reused operation IDs with changed content, including lost acknowledgments.
- Withhold mixed text/asset groups, their dependent multi-record edits and missing bytes in both reconnect orders. Unrelated records progress.
- Prove text/list convergence and independent map-key convergence. Preserve unsupported alternatives.
- Reject stale input, conflict and published-handler revisions, including third-client proposals.
- Recover accepted and pending work after an older relay restore, including accepted resolutions and their captured ancestry.
- Negotiate independently updated peers; preserve local work across unsupported peers and restarts.

The test fixture uses real isolated PGlite, PostgreSQL, and RustFS object storage.
It ports the grouped staging, ancestry and restore cases inspected in WS-272,
commit `565ceab57`, without importing its services or deployment setup. The original
20-test run and the failing restore/dependency logs are attached to PS-735.
This child adds wire validation, map/list, third-client and compatibility evidence.

## Handoff and remaining work

PS-745 owns durable workbench/environment identities and resource ownership.
PS-747 owns portable streamed bytes, completion, integrity and cancellation.
PS-746 owns durable grouped local storage and additive public SDK operations.
PS-743 owns the private relay workspace. Later relay work owns production
PostgreSQL publication, transport, replay, snapshots, retention and provider adapters.

This PRD does not establish production SDK, extension, dashboard, authorization,
automation, backup-cleanup, provider, capacity or deployment acceptance. The fixed
10,000-record/5 GiB workload and hosting estimate in PS-735 remain unchanged and
unmeasured here. Small buffered fixtures and fault injection are protocol evidence.
No cloud provisioning, product quotas, automatic history expiration, or public API
removal is authorized by this child.
