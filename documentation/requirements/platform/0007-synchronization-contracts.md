# PRD: Synchronization contracts v0.1

Status: Partly delivered in source, not released. Contracts, local storage, a relay,
account authority, and an opt-in native runtime connection are on `main`. Product
acceptance and release remain open. See the [delivery record](#delivery-record).

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

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is
`pstdio@0.43.1`. The newest nightly, `pstdio@0.44.0-nightly.20261018030230`, was
built from `77fa5d81`, before #1146. `infra/relay` and `infra/account-manager` are
private workspaces and ship in no npm or desktop release.

| Area | State | Main implementation | Availability |
| --- | --- | --- | --- |
| Protocol contracts | Delivered | #1126: `packages/pstdio-sync-contracts` | Private package, not published |
| Local storage | Delivered | #1136 workbench identity, #1139 resumable assets, #1140 grouped records in `packages/pstdio-sync` and `packages/pstdio-db/src/services/extension-storage/` | `storage.records` and `storage.assets` are in the nightly SDK, not in `@pstdio/sdk@0.43.1` (published type declarations checked) |
| Relay storage | Delivered | #1141 PostgreSQL groups, replay, and restore, and #1143 S3 assets, in `infra/relay/src/storage/` and `infra/relay/src/assets/` | Not released |
| Real transport | Delivered, opt-in | #1164 authenticated relay HTTP and finite WebSocket subscriptions. #1165 native runtime connection in `packages/pstdio-sync/src/relay/` and `packages/pstdio-api/src/services/relay/`. #1169 syncs extension records, files, and attachments and refreshes views. A runtime connects only when `PSTDIO_RELAY_CONFIG_FILE` names a connection file. The native client fetches snapshots; it does not use incremental replay. | `main` only |
| Recovery | Delivered in runtime code | The client journal requeues missing accepted work and its ancestry before pending work, and submits recovery proofs. Relay restore is an internal operator operation with no HTTP route. | `main` only |
| Authorization | Delivered in source | #1146 durable grants and #1163 Better Auth sessions in `infra/account-manager`. The relay checks finite access through `pstdio-account-manager/access`. | Not released |
| Product acceptance | Open | No dashboard view shows sync state, conflicts, or resolution. The [two-dashboard relay guide](../../guides/development/0008-two-dashboard-relay.md) is a manual check with no recorded pass. | None |

Evidence, with its kind:

- Protocol tests, passed locally on 2026-10-18 on macOS with Docker 29.7.2:
  `bun run --cwd packages/pstdio-sync-contracts test` (27 tests) and
  `test:conformance` (30 tests against PGlite, PostgreSQL, and RustFS). The
  documentation audit's HTTP 403 readiness failure was an environment blocker in
  its container and did not occur on this host.
- Real transport tests, passed locally on 2026-10-18:
  `bun run --cwd infra/relay test:transport` (29 tests in 16 files over real HTTP
  and WebSocket, PostgreSQL, RustFS, and the account manager).
- Unit tests, passed locally on 2026-10-18: `bun run --cwd packages/pstdio-sync test`
  (14 tests).
- CI: the `relay_smoke` job runs the relay storage, asset, transport, and isolated
  suites, the production-relay conformance entry, and the account manager suite.
  These were not rerun here.
- Gap: no automated test runs the API relay runtime against the real relay. The
  compiled smoke `packages/e2e/src/packaged/packaged-native-relay-smoke.ts` uses an
  owned wire peer.

The local dashboard stream is separate from relay content. It sends 11 runtime
tables, including `board_views` and `board_default_views`, and sends delete events
only after a delete succeeds. See [real-time updates](0003-realtime-updates.md).
Relay-synchronized records and files refresh views through the
`pstdio.event.storage-changed` event instead.

Remaining work: a recorded two-environment journey through the product, a sync and
conflict surface for people, live Google sign-in, deployed network and role
isolation, production backups and retention, release packaging, and the fixed
10,000-record/5 GiB workload and hosting estimate from PS-735, which is still
unmeasured. No cloud provisioning, product quotas, automatic history expiration, or
public API removal is authorized by this PRD.
