# Temporary bounded record working state

Proposed: 2026-10-22

## Status

Proposed for PS-905. The fixed workload requires a new boundary for local edit preparation. The selected-record design below needs the listed compatibility proofs before implementation is accepted. No performance acceptance is claimed.

## Evidence

After the [root-name encoding correction](0092-temporary-yjs-root-name-index.md), the unchanged database diagnostic at `5ac8cd7d079951f14bc022c7745f7250f129ab92` completed its full 100,000-row seed, four history rounds and ten cold samples. Every case retained its external 60,000 ms cap. Seeding and drain took 50,500.791 ms together. There were no retries, incomplete cases or cleanup errors.

Every first durable write failed the 1,000 ms operation ceiling. Its range was 2,545.223–3,389.744 ms, with p50 2,880.814 ms. The first sample blocked the event loop for 2,967.186 ms during a 2,968.236 ms write. Warm writes had p95 13.522 ms, and writes across checkpoint boundaries had p95 4.589 ms. Peak reported RSS across all phases was 14,307,786,752 bytes. Explicit checkpoint drain had p95 7,406.715 ms.

This memory failure is not confined to seeding. Database-open endpoints were 356–539 MB; first-write endpoints were 7.205–8.151 GB across the ten cold samples, and warm-write endpoints remained 7.205–8.153 GB. List endpoints reached 9.682 GB and folding-write endpoints reached 12.791 GB. The 14.308 GB process high-water mark was first observed at checkpoint drain. These phase endpoints and high-water observations do not by themselves attribute every allocation or separate concurrent background work. The revised boundary must reduce cold and retained memory, not only edit duration.

RP-1178 retains all phases, supervisor results, inventories and acknowledgements. These are database layer diagnostics, not full application acceptance. They establish that moving whole-owner preparation outside the database lock is insufficient. The cost of a one-record edit must depend on that record and its causal history, rather than unrelated records in the owner.

## Ideal design

An atomic edit loads the current structural state of only the records it touches. That state preserves the original identities needed to merge later offline edits. Persisting the edit, its retry outcome, current-record projections and structural read indexes is one transaction. Queries read bounded projections. Sync retains a complete authoritative owner history and can export it without exposing a partial view.

The owner remains the security, encryption, wire and atomic-commit boundary. It need not also be the in-memory working set for every local edit. A local transaction touching several records must still succeed or fail as a unit.

## External limitation

Yjs updates use client clocks shared by items in different named roots. Applying an arbitrary subset with missing clock ranges leaves its items pending. Root names alone are therefore insufficient to split an existing update into independently editable documents. Renaming roots, assigning new item IDs or replaying only JSON values would break text/list positions and the original offline merge identity.

Yjs exposes update decoding and low-level struct/encoder types, but no supported selected-root working-document API that preserves the omitted history separately. A clean application-level solution cannot simply construct an ordinary Y.Doc from a record's JSON projection. The proposed adapter is temporary because it must understand this pinned binary representation and enforce a stronger export boundary than an ordinary Y.Doc provides.

## Options

| Option | Cold edit work | Compatibility and cost |
| --- | --- | --- |
| Cache or prepare the entire owner in a worker | Still loads the owner before the edit can finish | Measured cold delay remains; moving the work does not pass the contract. |
| Give each record a new independent Y.Doc | Bounded for new records | Requires translating old owner updates, cross-record commit envelopes and old offline positions; resetting identities is unacceptable. |
| Index original per-record structural fragments and construct a private working view | Bounded by the selected records and their causal prerequisites | Preserves the existing authoritative wire history, but requires an isolated binary adapter and proofs that omitted state never escapes. |

The proposed direction is the third option. If it cannot preserve the invariants below or cannot meet the same fixed workload, this ADR must be revised before choosing an explicit wire/document migration. Keeping the measured cold failure is not an accepted fallback.

## Proposed working-state boundary

### Authoritative bytes and derived fragments

The existing durable owner checkpoint and update tail remain authoritative. Add a rebuildable structural index owned by the storage service. Each record's entry retains its original structs, relevant deletion ranges, original and retired generation metadata, and the source revision needed to detect stale indexing. The fragment format must distinguish omitted clock ranges from real garbage-collected source structs.

The index includes the selected keys of `records` and `deleted`, the selected generation keys of `retired-records`, every owned root needed by the record, and the exact origin, right-origin and parent dependencies needed to integrate those structs. It cannot retain only the visible JSON tree: old list/text positions, retired generations and later offline edits can refer to hidden history.

Fragments must remain sparse. They must not persist virtual garbage-collection ranges. Combining independently filled fragments would let one record's synthetic range replace another record's real item. Combine selected original fragments and their dependency closure first. Only then may a private working document fill omitted client-clock ranges to make the selected state executable.

### Non-exportable edit view

Only the storage adapter owns a working document. Callers receive the existing record operation interface, not a partial document snapshot. A working document is never used for owner export, state-vector comparison, checkpoint compaction, sync acknowledgement or incoming-update validation.

Capture only new transaction update events as the outgoing edit. Verify that their structs and deletion ranges are real changes to selected records and that no virtual clock filler is emitted. Existing root names and item IDs remain unchanged; normal new edits use a fresh actor. Include deterministic migration/text-promotion actor handling in the compatibility proof.

Actor clocks require their own authoritative lookup. A deterministic actor may already have clocks outside the selected fragment; starting it at zero would silently collide with existing source items. Check the actor heads of a private draft before exposing its events. If a required head was omitted, reconstruct the private view with that head and replay only the fixed, internal record edit description. Do not replay extension callbacks, observers, asset writes or already published outcomes. Recheck affected actor heads at durable admission. The prototype has a red/green fixture for an actor used by an unrelated root before the selected edit.

Fragment lookup uses a persisted record-to-root ownership index, followed by exact structural dependencies. It must not enumerate all owner roots, client structures or fragments during a selected edit. Build ownership explicitly during backfill and maintain touched ownership with accepted updates. The prototype makes owner-directory enumeration throw after indexing and checks selected-state size as unrelated records grow.

An atomic group loads the union of its records once, validates expected revisions, performs the existing edits, and commits original incremental bytes, retry identity, query projection changes and updated structural fragments together. A failed transaction publishes none of these. A cache miss must not trigger whole-owner hydration.

Generic full-document work remains explicit: legacy full lists, export, text-document operations, migrations and index rebuilds do not silently become selected-record transactions. Point reads and retry outcome lookup should use their durable bounded interfaces.

### Upgrade and old writers

Build the structural index during explicit upgrade/index installation using the original source bytes. Backfill must be restartable and atomic, with the same source-revision guard as current-record projections. An old writer that advances source bytes without maintaining either index invalidates both. It must never cause a stale fragment to be accepted as current.

Late 0.45 offline updates keep their original IDs and apply to the authoritative owner history. Retired original generations and explicit restored generations retain the rules established by PS-906. A fragment rebuild must preserve pending structs and delete sets whose predecessors have not arrived. It must not convert a missing predecessor into authoritative deletion.

Only integrated source structs enter a working fragment. Canonical pending updates remain exclusively in the complete authoritative source until their real predecessors arrive. Applying them to a view with virtual clock coverage could otherwise satisfy a missing predecessor and expose a value early.

### Receive, admission and fairness

Large incoming preparation must run outside foreground owner admission and outside the database transaction. A completed preparation carries its source revision and affected-record evidence. Durable publication rechecks that source and updates source bytes, current rows and structural fragments atomically.

A concurrent local write must not force repeated whole-owner preparation until incoming sync starves. The implementation must prove bounded incremental rebase of a prepared receive against the later tail, or use affected-record revision guards with a proved merge rule. The final admission section may include only bounded work; it cannot hide another full-owner decode under a different lock. Keep worker admission before snapshot allocation, cancellation, pending-envelope retention and fair service across owners.

The exact receive preparation/rebase protocol is an open design proof. It must be resolved before this proposal is marked accepted. Fixing an idle cold edit alone does not pass the busy-sync contract.

## Structural prototype evidence

RP-1178 contains a report-only prototype with one actor interleaving three rounds across 1, 1,000 and 100,000 unrelated records. Selected reconstruction retained 15 original structs, 19 working structs, seven roots and four virtual ranges at every size. Sparse bytes were 995, 1,007 and 1,019; larger original clocks require larger variable-length integers. Owner-root and client-directory enumeration was forbidden after explicit index creation. Applying the emitted selected edit to the complete source reproduced the private result and preserved unrelated state.

All three unchanged structural cases completed within their existing 60-second cap with no cleanup errors. External packaged browser and Docker work was active and unacknowledged. This is structural and semantic evidence only: its durations and memory are ineligible for acceptance, and its fixture is not the fixed database workload.

Nine focused prototype tests also cover pending predecessors, two-record union, deterministic actor reuse, retired generations, failed private edits and supported map/text/list deletion. A failed edit initially left earlier private mutations alive. The corrected prototype destroys and reconstructs the private view from original sparse fragments and accepted events before another attempt. Named-root deletion operations emitted real Items and deletion sets; none emitted virtual ranges. These tests do not yet prove durable fragment publication, asynchronous actor-head consistency or fair receive.

### Causal activation blocks selected publication

A further hostile fixture exposes a correctness blocker. A remote text promotion's original seed is delayed while its real actor suffix and a later edit to another record arrive first. The source retains them as pending. Local edits replace the first field with a number, then its original primitive string. Promoting that string locally emits the original deterministic character IDs. Those real predecessors unblock the remote suffix and the other record's pending edit. Publishing only the locally selected record would leave the other record's query row and structural fragment stale.

The report retains the failing `record-working-causal-activation.test.ts` fixture and its output: canonical pending state becomes empty, record B changes, and the prepared publication contains only A. The selected adapter must remain disconnected until this is fixed. Preserving pending bytes exclusively in the canonical source is necessary but insufficient; local events can legitimately activate them.

Before publication, compute the exact ready causal closure from newly emitted actor ranges. This needs indexed pending waits and actor-clock-to-record ownership. Repeatedly advance ready original client prefixes, include every newly integrated affected record, and publish source bytes, rows, fragments, actor heads, waits and retry outcome atomically under the captured source revision. Pending deletion ranges need equivalent handling. Never apply all pending owner bytes to a filled view, or hide a whole-owner rebuild behind a fallback.

The minimal persisted representation remains under review. Opaque whole-record blobs require a separate actor-clock ownership index to resolve inherited Item parents. Original struct chunks keyed by actor-clock ranges with a record lookup index may provide both selected reads and causal ownership without duplicating that index. Only rebuildable structural data is proposed; product data and original wire history remain authoritative. A large real causal cascade is actual affected work, distinct from unrelated owner records, and must not be mislabeled as constant work.

## Required proofs

1. A selected record opened from sparse original fragments has the same value, revision, deleted state, asset and shared map/text/list state as the complete source. Include histories from several clients, deleted items, retired roots and missing causal predecessors.
2. A new local edit produces only original incremental wire changes. Applying it to a complete old-format replica changes exactly the selected records. Unselected records and their offline positions remain intact.
3. Combining two selected records cannot allow virtual filler from either to overwrite the other. No filler can reach durable source, sync export, deletion sets or checkpoints.
4. Multi-record expected-revision failure, rollback and retry preserve atomicity. Operation IDs and fingerprints match the existing API. Shared text/list edits and deterministic promotion remain convergent.
5. Receive-before-local, local-before-receive, delete/edit and explicit restore converge in both orders, including a real 0.45 writer and a pending update delivered before its predecessor.
6. Old-writer invalidation and an interrupted structural backfill preserve source bytes and retry identities. Rebuild uses explicit upgrade work, not the first cold record operation.
7. Continuous local edits do not starve incoming publication; incoming work does not hold foreground admission while decoding the owner. Shutdown, cancellation and failed durable acceptance retain pending work.
8. Targeted checks, packaged worker/storage/upgrade verification and all applicable CI pass. Then rerun the unchanged fixed workloads in acknowledged exclusive windows, including cold edits, same-owner contention, sustained receive, checkpoint drain and memory. No budget, timeout or workload change is part of this decision.

## Limitations

The structural index adds rebuildable persisted state. It has one owner and must be maintained in the same durable transaction as source and current-record projections. The format and dependency closure are not yet proven; this proposal is not permission to ship a partial implementation.

The temporary binary adapter must stay inside the sync/storage boundary, use the pinned Yjs version, and have original-byte/merge compatibility fixtures. Extensions must not see synthetic state, binary fragments or new coordination flags. Public record APIs remain unchanged.

A record with very large content or history can still be expensive. Full-owner background validation and compaction also need measured memory and fairness proof; bounding local working state does not establish those properties by itself.

## Removal

Replace the temporary adapter when a supported Yjs API can construct an equivalent selected working state without virtual clock gaps, or when an explicitly approved wire/document migration preserves the existing offline identities and atomic groups. Rebuild or remove derived fragments through the normal migration path. Retain convergence, rollback, missing-predecessor and fixed-workload tests. Never remove the adapter merely because the owner cache makes a warm sample pass.
