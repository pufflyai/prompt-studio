# Encrypted owner commit streams with bounded source manifests

Proposed: 2026-10-23

## Status

Proposed implementation for PS-902, PS-905 and PS-906. The approved performance repair permits changing document boundaries when whole-owner work fails its fixed acceptance workloads. This decision extends the existing relay's storage representation; it does not replace the relay, add a recovery feature or change retention policy. Deployment and production cutover remain gated by the proofs below.

The host storage work in PS-905 and PS-906 owns the Temporary adapter for original owner-wide Yjs history. This decision owns durable transport groups and bounded manifest storage. It does not make sparse legacy fragments independently executable documents.

This delivery contains only relay graph retention and cleanup. The owner-stream client, host source migration, capability negotiation and public manifest upload route remain separate implementation work.

## Problem

Selected local storage can prepare a resource without loading unrelated records. The current relay client still loads a complete local checkpoint for comparison and retains a complete remote checkpoint when staging changes. A cold synchronization or owner-wide checkpoint therefore keeps the memory cost that the performance repair must remove.

The relay currently protects only blob IDs listed directly by a retained update or latest state. A paged encrypted manifest cannot hide its child references inside ciphertext: cleanup would treat those children as unused. Flattening every resource, pending source part and asset into one root envelope would recreate an owner-sized boundary and exceed the existing reference limit.

## Decision

### Ownership and durable groups

The extension owner remains the authorization, encryption and atomic visibility boundary. Each accepted local group receives one durable random group ID. The source transaction saves original causal events, affected typed fragments and current values, the existing operation receipt, and the outgoing group together. The public operation ID and local source revision are separate identities. A newly accepted no-op can have a new group and receipt without adding actor history or advancing the source revision. Replaying its operation receipt cannot create another outgoing group.

The outgoing group records its original causal namespace and every producer operation accepted in the same transaction. A legacy transaction can accept several operations; it remains one transport group, not several independently visible groups. Local groups reference the existing immutable operation receipts through a group-to-operation table. An imported legacy update has no fabricated public operation ID. Receiver diagnostics may report a producer operation only when that identity crossed the authenticated transport boundary and the complete group was accepted durably.

The database source service does not own encryption keys. A later transport stage seals a group's immutable parts and envelope, then saves those exact ciphertexts and random transport IDs durably before upload. A crash before sealing can repeat preparation from original bytes. A crash after sealing reuses the saved identity and ciphertext. Source tails folding cannot erase an unpublished group. Pending groups reference exact authoritative events by accepted revision and event ordinal instead of copying payload bytes. The checkpoint owner excludes referenced events from deletion. Foreign keys enforce event existence on reference insertion and cascade when the source owner is deliberately deleted; they do not replace lifecycle retention rules. Acknowledgement removes its bounded references and prunes only those now-unreferenced events already covered by a checkpoint.

The receiver downloads and validates all required parts before source publication. Its transaction accepts the selected original events and causal closure, current projections, remote group receipt and stream cursor together. Missing parts, cancellation or rejected preparation cannot advance that cursor or expose half the group. Duplicate delivery returns the durable original result. Local source revisions are never used as cross-device revision identifiers.

### Bounded encrypted representation

Use a new opaque owner-stream address, separate from the released legacy document address. Preserve the current project and private-user spaces, membership checks, key generations and authenticated encryption.

A commit root names its format, causal namespace, group ID and immutable manifest root. A manifest page has a bounded fan-out of 256 child descriptors. Typed affected identities, original bytes and asset references live in encrypted pages or leaves. Each descriptor binds the child's opaque blob ID, ciphertext hash and length. The root does not enumerate all affected resources or all reachable assets.

Operation receipts also live in encrypted manifest leaves, with at most 256 receipts per leaf and the same node byte ceiling. Each receipt carries its producer identity, operation ID and fingerprint. The commit header contains no unbounded receipt array. A no-op group has receipt leaves and no source events; its manifest is still required. Groups with more receipts use more bounded leaves without changing the original transaction boundary or introducing a new workload cap.

The latest state is a bounded encrypted manifest root at the relay's existing `through` cut. A persistent tree allows a small accepted edit to replace its leaf and ancestor path without loading unrelated source bodies. Source leaves preserve all original history required by the supported merge rules, including pending items, deletion ranges, retired generations and identity aliases. Compaction is not permission to regenerate IDs from JSON or discard causal history. Preserve original unowned and auxiliary structs as bounded source-part leaves too. A legacy causal-prefix root can unlock a selected resource even when it is not classified as a resource or known metadata entry. Never assign it a public sentinel resource ID, omit it from bootstrap, or change exact legacy source export.

Bootstrap reads pages into durable staging with bounded concurrent downloads. It exposes the new source generation only after complete verification and preserves local offline changes while accepting that generation. An interrupted bootstrap remains incomplete. Ordinary status reads use durable stream/outbox metadata; they do not enumerate resources or compare full Yjs states. Full exports are explicit streaming operations.

### Relay-visible immutable references

Add immutable child references to blob storage. The relay sees only opaque blob IDs and routing/storage metadata, as it already does for direct envelope references. It never decrypts a page or learns resource names or values.

Register children before completing the parent. All children must already be complete in the same project and encryption space. The parent bytes and child set are immutable, and retries must match both. A new parent cannot name an incomplete future parent. This bottom-up rule prevents cycles without loading arbitrary client graphs in a request.

Existing retained updates and latest states remain the authoritative roots. Reference reachability includes completed immutable child edges. Staged uploaded blobs receive only the existing unused-upload protection; a child reachable from a newly completed staged parent cannot be deleted during that parent's existing protection window. Root publication still verifies complete referenced objects before acceptance.

Keep the existing retirement and grace semantics. Replaced states and covered updates are retired by the existing rules. A shared descendant stays live while any retained root reaches it. When a root retires, propagate its last-use time to the reachable closure. Do not start another grace period at each tree level. An unreachable uploaded tree expires under the same unused-blob grace as an unreferenced flat blob. Account quota, request rate, payload sizes and the 100,000 direct-reference limit do not increase. Graph traversal belongs to bounded relay cleanup batches, not the local edit transaction.

The current state replacement compare-and-swap remains mandatory. A state built on a stale root cannot replace the accepted one. The encrypted summary must still prove coverage of original edits, including deletions; a state vector alone is insufficient. An incomplete bootstrap cannot delete updates that another device still holds.

### Protocol compatibility

Keep protocol version 1 and the released document endpoints unchanged. Add explicit negotiation for the owner-stream/reference representation. A newer client must not send a new body to a version-1-only relay and silently reinterpret rejection as success. The selected representation is unavailable until a capable relay has been deployed and verified.

The legacy bridge retains original owner addresses and original Yjs updates. It imports old-device changes through indexed causal acceptance and emits the corresponding owner-stream group atomically. It exports owner-compatible original events back to the legacy address, including new resources, deletes and restores. Durable bridge identities suppress echo. Private causal fillers are never persisted or transmitted. While an owner supports released writers, new resources remain in its compatible causal namespace.

## Alternatives

- Keeping a full owner checkpoint in a worker preserves the measured owner-sized memory and cold work. Moving it off the foreground thread alone does not meet the repair contract.
- One independent relay synchronizer per resource avoids one large document but enumerates and instantiates all resources, and does not preserve multi-resource atomic visibility.
- Flattening a manifest's references creates an unbounded root and can exceed the existing reference limit.
- Giving every page its own permanent latest-state address leaves orphan pages outside the current blob lifetime rules. It would need another retention mechanism.
- Keeping every original group forever would change the relay's history and storage contract. It is not part of this decision.

## Implementation and validation gates

1. Add bounded manifest/commit validation and round-trip tests for exact original bytes, typed identities and no-op groups. Missing, altered, cross-space or inconsistent parts must reject before acceptance.
2. Prove graph retention using the real relay database and object-storage boundary: shared descendants, staged upload interruption, exact grace cutoffs, two replacements, stale replacement, account quota, access isolation and version-1 compatibility. Do not raise limits.
3. Add local outbox and remote receipt/cursor publication under the existing source transaction. Kill and reopen around each durable boundary. Prove two-resource visibility, rollback, retry after lost reply and no-op identity.
4. Integrate paged bootstrap and the released-0.45 original-byte bridge, including delayed A unlocking B, new local writes before old reconnect, deletion/restore, assets and resource aliases.
5. Replace owner-wide comparison, discovery and checkpoint paths only when the complete transport and bootstrap contracts hold. Prove bounded captured/queued bytes and fairness across ten owners, then run the unchanged prepared performance workloads on required platforms.

## Consequences

The relay gains a reference graph and the client gains a durable outgoing-group boundary. Those are necessary owners of transport durability and retention, not parallel editable copies of record values. The design needs an explicit relay rollout before cutover. It keeps the user's existing data, supported offline behavior and seven-day default grace; it does not make pending code or diagnostic performance a release result.

## References

- [Synchronization contracts](../references/architecture/0026-synchronization-contracts.md)
- [Local-first sync requirements](../requirements/platform/0014-local-first-sync.md), R8–R29
- [Storage scale evidence contract](../references/performance/0005-storage-scale-diagnostic.md)
