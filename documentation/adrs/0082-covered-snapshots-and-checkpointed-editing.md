# Covered snapshots and checkpointed editing

Proposed: 2026-10-18

Status: Superseded by [PRD 0014](../requirements/platform/0014-local-first-sync.md) on 2026-10-19.

## Decision

Replace permanent per-edit retention with locally recoverable live editing, checkpoints,
and retention below a verified coverage boundary. Use fenced stream generations and
per-environment sequence floors instead of an eternal operation ledger. Rebuild CRDT
state only at a coordinated document boundary. Replace alpha formats directly;
there is no historical migration or mixed-protocol adapter.

The platform owns these rules. Only it can coordinate enrolled environments,
publication, recovery, immutable assets, and independently verified backups. This
fits [the mission](../guidance/0001-mission.md): extensions keep their normal file and storage
interfaces, and people and agents use the same authorized operations.

## Ownership

The host document owner keeps one live Y.Doc per document session and atomically
replaces its local recovery file. It acknowledges an edit only after the replacement
is durable. The live relay carries memory-only updates; delivery is not a remote
storage acknowledgement. Reconnect combines durable catch-up with peer state-vector
exchange.

A five-minute, dirty-close, explicit-save, or graceful-shutdown checkpoint freezes
one recovery revision. Its document delta and all save-handler projection mutations
form one sealed group. Capture storage writes in a fork, stage complete immutable
bytes, persist the frozen group for retry, and publish it once. Preserve the
revisions observed when the editor loaded. Later recovery revisions survive an
older checkpoint reply. Events and disk projection follow accepted publication.

Relay storage owns snapshots, writer floors, outstanding outcomes, and the publication
boundary. Current authorization and durable environment installation precede coverage
acknowledgement. The backup owner supplies exact manifest checksums and independent
verified byte copies. The common covered cut cannot pass offline environments,
required branch ancestry, active recovery, or in-flight publication and capture.

Retirement replaces only covered terminal outcomes with writer floors and advances
the stream generation atomically. Active identities retain their immutable outcomes.
Retired or restored identities require resynchronization and preserve proposals;
they never execute as new writes. Outstanding exceptions retain their bytes and
ancestors. Physical deletion follows committed retirement and rechecks current roots
under the publication lock. A failed deletion is safe to repeat.

Document rotation first fences every participating writer, checkpoints its edits,
and proves recovery coverage. It publishes one shared fresh CRDT seed with a new
document generation. Writers install that seed before resuming. They never seed
independently or attach old relative positions to the new generation.

## Trade-offs

Disk projections may lag live editing by five minutes. Machine loss can lose edits
that exist only in the machine's recovery file. Disk failures cannot be reported
as saved. Offline environments, unresolved work, incomplete backups, and retained
backup copies can delay or consume storage. A document generation change can reset
undo history and requires selection remapping.

## Alternatives

Per-pause assets, 500-ms durable batches, and full-state journal rows still grow with
edit count. Closing-only checkpoints allow unbounded projection lag. Time-based
expiry loses offline work. Keeping every operation digest moves the leak into
metadata. Yjs update merging does not collect all lifetime metadata, and reusing one
Yjs client ID across sessions is unsafe.

## Delivery

PS-808 defines strict contracts and an isolated executable reference. PS-776 adopts
host/live editing; PS-780 owns production backup capture; PS-781 owns automatic
production retirement and deletion. This decision does not claim those production
owners are deployed. The runtime and relay must adopt protocol 2 together, without
falling back to per-pause durable saves for collaborative documents. See
[checkpoint contracts](../references/architecture/0027-covered-checkpoints.md).
