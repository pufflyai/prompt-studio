# Covered checkpoint contracts

PS-808 defines protocol 2 checkpoint, coverage, recovery, and retention contracts.
Its executable owner is an isolated reference; production adoption belongs to
PS-776, PS-780, and PS-781. See [ADR 0082](../../adrs/0082-covered-snapshots-and-checkpointed-editing.md).

[PRD 0014](../../requirements/platform/0014-local-first-sync.md) replaces these
contracts. Production adoption is stopped. This reference describes the code on `main`
until it is removed.

## Scope and rollout

The [checkpoint schemas](../../../packages/pstdio-sync-contracts/src/checkpoint.ts)
and [retention schemas](../../../packages/pstdio-sync-contracts/src/retention.ts)
are strict. Every checkpoint names its account/workbench/extension scope, restore
epoch, stream generation, enrolled writer, and monotonic writer sequence. Its
fingerprint seals these facts together with the document generation, consumed
recovery revision, parent references, document delta, and complete projection group.
The reference reuses existing record staging rules internally; its protocol 2
boundary rejects protocol 1 envelopes. This is not an old-client adapter.

The current production owners still use protocol 1. This ticket neither enables
production compaction nor changes the native editor's save scheduling. Their later
cutover must update host and relay together, reject mismatches clearly, and keep
local proposals. There is no historical conversion requirement and no fallback to
per-pause durable file synchronization for qualifying collaborative documents.

This is reusable platform plumbing. Notes and Planner have no relay, Yjs, or backup
settings. Extension load/save, file, and storage interfaces remain the authoring
boundary. Credentials, sessions, processes, unpublished overrides, and presence
remain outside content snapshots.

## Checkpoints and recovery

One host-owned live Y.Doc serves a document session. Each live or durable message
binds to its document generation. Local recovery stores encoded state, checkpoint
state vector, projection baseline, current and checkpoint recovery revisions, and
the frozen retry intent and sealed group. A host acknowledges local recoverability
only after atomic durable replacement. The POSIX reference syncs the temporary file,
renames it, and syncs its directory. This is a durability contract for production
owners, not a completed cross-platform native document service.

Checkpoint after five minutes of dirty editing, dirty close, explicit Save, and
graceful shutdown. Freeze a particular recovery revision and document delta. Run
save-handler transformations against a capture store. Reads see captured writes;
intermediate writes do not enter the durable journal or disk projections. Stage
and verify every complete immutable asset before publishing. Persist the sealed
checkpoint in recovery before the first send and retry its exact bytes after a
lost reply. Completing revision N never clears recovery revisions after N.

[`captureCheckpoint`](../../../packages/pstdio-sync/src/checkpoint-capture.ts)
coalesces captured storage writes with their first observed preconditions and final
values. The host supplies the same storage observer used by ordinary saves. The
[handler proof](../../../packages/pstdio-api/src/services/shared-files/checkpoint-handlers.integration.ts)
runs unchanged Notes and Planner handlers through staging ports backed by real local
storage and asset verification, then publishes their mutations and the document
through one reference PostgreSQL transaction. It covers Notes frontmatter and sidecar
deletion, Planner title derivation, lost replies, and a stale load revision that
conflicts the whole group. It does not route production renderer calls yet. PS-776
must connect these ports and defer events and disk projection until publication.

Live relay delivery is memory-only. A received frame is never a durable relay
receipt. On reconnect, install durable catch-up and exchange peer state vectors to
repair missing live frames. Preserve local recovery before installing a different
epoch or generation; do not reinterpret its old CRDT identifiers as current edits.

## Coverage and safe cuts

A covered snapshot includes current records and required tombstones, document
generations, a stream cut, covered cut, enrolled writer floors, outstanding receipts, conflict revisions, publication revision,
and explicit retained branches. Required assets are the current live record assets
plus the complete asset/base/ancestor closure of retained branches. A new enrollment
must not download obsolete accepted versions merely because they appear in an
uncovered receipt tail. `coveredAssetClosure` computes this boundary.

A coverage acknowledgement is scoped to an enrolled authenticated environment,
restore epoch, stream generation, exact snapshot checksum, and installed cut. Local
installation is durable before acknowledgement. It accounts for pending branches
and active recovery revisions, their base cuts, and needed ancestry. A future
recovery checkpoint, unknown branch, wrong scope/epoch/generation, or mismatched
snapshot is invalid. Authorization remains outside the content envelope.

A complete verified backup supplies independent coverage with the exact manifest
checksum. Partial capture supplies none. The safe cut is the common environment and
backup boundary, restricted by branch ancestry, active recovery, and in-flight
publication/capture. It has no TTL and assumes no maximum offline duration. Blockers
name the environment, backup, recovery, or retained branch that prevents advancement.
Already committed coverage cannot regress.

## Receipt retirement and object reachability

Within the active stream generation, a writer sequence and immutable digest retain
the original terminal outcome. A changed payload cannot reuse that identity.
Pending outcomes can progress only with their original bytes. Retirement atomically
advances the generation and replaces covered contiguous terminal outcomes with
per-environment sequence floors. Gaps and retained exceptions keep explicit outcomes
and necessary ancestors. There is no permanent row for each covered edit or retired
generation. Writer sequences continue above their floors and outstanding work.

Old-generation and old-epoch submissions return resynchronization with the original
proposal. They never execute as fresh writes. Preserve source bytes and observed
preconditions while preparing a new-generation proposal; unsupported divergence
remains an explicit alternative. A pending exception can be rebased by its writer
with exact source digests, a current snapshot checksum, complete pending ancestry,
and unchanged observed scalar, asset, deletion, and map-key preconditions. Accepting
that new group settles its sources atomically. A known pending retry retains its
already validated snapshot intent; it never changes its bytes. A missing retired receipt is not proof that a
previously accepted write was lost.

Current records, pending/conflict branches and ancestors, uncovered recovery/tail,
and in-flight publication or backup capture are live reference roots. Completed
backup manifests own separate immutable copies. They do not pin obsolete live
versions forever. A reference index is derived, not another operation ledger.

Retirement commits before physical deletion. The deletion transaction rechecks the
current roots and pins while holding the same publication boundary. A publisher
must acquire its pin and verify complete bytes under that boundary too. It either
wins protection before deletion or finds missing bytes and stages them again. A
crash after deleting an unreachable object cannot restore a receipt that references
it: retirement was already committed. Retrying deletion completes partial cleanup.

## Document generation barrier

An enrolled offline writer blocks rotation. Start a barrier, checkpoint dirty work,
install peer changes, and obtain durable recovery coverage from every writer. A
joined writer is fenced from new writes. Every required writer must join; pending
or conflicting work, dirty recovery, or incomplete backup prevents rotation.

Seed one fresh Y.Doc from accepted current text and atomically publish that seed
and the next document generation. Every host installs the identical seed, with its
own new session writer identity, before resuming. Independently seeding identical
text would create distinct CRDT insertions. Old frames and relative positions cannot
attach to the new generation. The host must remap selection and reset undo history
at this coordinated boundary.

## Backup and restore

The manifest names the exact covered snapshot, writer frontiers, coverage evidence,
asset and package copies, and checksums. Verify every copy and the manifest before
recording backup coverage. The reference's package list is empty; production package
capture and scheduling belong to PS-780. Backups remain usable without live object
storage. Content restore preserves scope and starts a fresh epoch; it never restores
authorization or credentials. Old coverage cannot cover the new epoch, though its
explicit recovery roots remain protected until environments account for them.

Returning local installations retain their records, proposals, and complete source
bytes. The reference preserves newer local content as an explicit recovery proposal
after an older backup restore, including when covered operation bodies are gone.
Unavailable bytes produce `recovery-unavailable`; they cannot be reported as
synchronized. PS-782 owns production restore and user-facing reconciliation.

## Executable validation

```sh
bun run --cwd packages/pstdio-sync-contracts test
bun run --cwd packages/pstdio-sync-contracts lint
bun run --cwd packages/pstdio-sync test
bun run --cwd packages/pstdio-sync lint
bun run --cwd packages/pstdio-sync-contracts test:conformance
bun run --cwd packages/pstdio-api test:conformance
```

The default reference entry includes coverage and POSIX document recovery cases.
Use a different `SYNC_TEST_SUBNET` for concurrent isolated stacks. The handler entry
uses isolated PostgreSQL/RustFS and real temporary local PGlite/assets. Neither opens
the application's database. The reference covers thrown faults at publication,
acknowledgement, recovery replacement, and deletion boundaries. Production process
kill, native UI lifecycle, cross-platform file durability, and automatic compactor
validation remain with the owners above.

Repeated insert/delete and document-session cycles measure real Yjs structures after
shared-seed rebuild. Repeated covered checkpoint cycles measure receipt counts,
writer floors, and live asset inventory. Explicit backup copies and unresolved/offline
work remain separate costs. These checks do not replace or shrink PS-735's fixed
10,000-record/5 GiB workload, set a product quota, or increase a time limit.
