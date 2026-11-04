# Order record saves and declare collaborative text

Proposed: 2026-11-01

Status: Accepted for PS-1016; the client implementation is local. Full qualification and SDK/extension delivery remain incomplete. The ticket's human decisions approve the semantics and implementation scope. This does not claim the new format has shipped.

## Context

[PRD 0014](../requirements/platform/0014-local-first-sync.md) currently gives every value CRDT history. A line break silently makes a string collaborative text, and arrays merge items. Authors cannot predict a whole title or list after offline changes. The relay already orders encrypted updates; it can provide that order without reading values or choosing merge rules.

This changes record merging from [ADR 0102](0102-record-stream-sync.md), retaining its encrypted owner stream, assets, latest states and blind relay. Actual shared editable files retain [ADR 0132](0132-host-owned-shared-text-documents.md)'s native text owner.

## Decision

1. Plain records use changed JSON paths in relay order. The later write wins at each path. Arrays and undeclared strings are whole values, including multiline strings. Newly introduced nonempty objects contribute their leaves; an explicit empty object or scalar/array-to-object type change writes that whole value.
2. One save remains an atomic group. An optional `expectedRevision` refuses the entire group when an earlier ordered write changed an overlapping path since that observation. Unrelated siblings do not refuse it. Per-path write stamps and record lifetimes detect deletion, recreation and ABA changes even when content returns to its old value. Canonical stamps identify the ordered occurrence by epoch and operation ID. Pending observations instead bind the unresolved operation ID and fingerprint; only its exact accepted receipt resolves that dependency to a canonical occurrence. A known refusal overrides a restored optimistic view, and a missing receipt blocks ordered resolution.
3. Authors declare collaborative text by record prefix and JSON Pointer. Only declared text uses Yjs. Its updates share the record stream and can be included in the same atomic group as plain fields. Real editable files keep their native owner and transport.
4. Generic logs are append-only, paged and followable. Project logs use relay order; device logs have independent writers. Retention is described by page metadata so a new reader does not fetch expired pages. The relay protocol and its confidentiality boundary do not change.

## Canonical state and pending saves

Store canonical state per record separately from the indexed optimistic query projection. Persist each immutable local group before transport opens, including its identity, fingerprint, changed paths, conditions and text dependencies. An outbox is delivery bookkeeping, not the sole copy of a save.

Local commits update only affected records. Applying relay input changes canonical state and settles exact outcomes in the same owner transaction as its cursor. Rebase affected pending work over that canonical state. Accepting the writer's pending prefix need not replay its remaining overlay. A delivery acknowledgment alone never settles a condition or deletes its envelope.

Founding publishes a complete base and an explicitly included pending prefix atomically. Adoption preserves remaining envelopes and their original conditions. A founding state is not one author commit: preserve per-record limits and bounded SQL batches instead of imposing the 4 MiB group limit on an entire project.

## Observations and retries

A portable observed revision contains the record lifetime, path stamps and a digest/kind tree of the plain value. This derives replacement paths across commands and restarts without retaining every read or copying old large scalar/array content into the token. An observed baseline and an explicit condition have separate meanings. Maintained read-modify-write callers pass their observed revision; explicit set/delete paths need no inferred baseline.

Keep exact operation fingerprints and decisions through compaction and an older database restore. A writer frontier does not prove acceptance. Use the existing encrypted manifest-blob graph for a paged receipt index; a bounded latest-state root does not make total receipt history constant. Unchanged pages are reused. Missing index data blocks reconciliation rather than authorizing reevaluation.

Bind an operation ID to its fingerprint globally within retained knowledge. Decisions are keyed by order epoch and operation ID. Within an intact epoch, a duplicate returns its exact original result. A real relay-loss founding starts the approved new order: a known old decision settles pending work before replay; otherwise an unsettled immutable save can enter the new epoch. Later historical receipts cannot rewrite that new order. Cache eviction or a failed request never establishes an epoch.

## Text ownership and refusal

Record-backed native fields resolve to the ordered record's text owner. Their bind/write/read/export/adoption paths do not create or advertise a second `native-markdown` sync document. Existing native documents remain migration input and recovery evidence. Asset-backed editable files retain their existing native owner.

An explicit record group can carry text updates and their pending-operation dependencies. It is accepted or refused whole. Unconditional native typing can use idempotent text-only frames in the same record stream, without creating an everlasting record-operation receipt for every keystroke. Such frames retain any unsettled group dependency whose structs they observed; they cannot publish a refused group's text through another route.

When a local pending group is refused, preserve affected editor work in the existing private recovery path before replacing its optimistic text view. Advance that local replica's source-address fence so an admitted stale handle, dependent delta or full-state resend cannot rejoin as the current source. Canonical text history remains the single authoritative history; another device that never observed the refused structs need not lose its valid edits. A new source admission starts from canonical state. This needs real public/native adapter tests, not just a generation-check helper.

## Migration and compatibility

Found each owner in the new client format, preserving records, tombstones, assets, native lifetimes and pending work. The first full writer supplies its base; later devices adopt and replay later saves. Retain legacy input until conversion is durable. Older clients do not participate in the new format.

Public extension methods follow deprecate-first rules. Add replacements beside legacy `shared` maps/lists and conflict APIs; migrate maintained consumers and the SDK two-device simulator. Do not remove public signatures merely because a new storage implementation is simpler. The deprecated explicit shared-text API remains an explicit text intent during its compatibility period; a line break alone never declares text.

## Consequences and proof

- Plain sync work follows changed paths and affected records instead of owner-wide CRDT histories. Conditional outcomes require durable metadata; this is a cost, not a claim of constant total storage.
- Only text owns CRDT state. Conditional refusal must fence optimistic replicas rather than try to subtract Yjs structs or merge them back from a stale editor.
- Stable IDs, opaque revisions and typed outcomes work through the same public interface for people and agents. There is no new screen, merge-rule callback or relay authority.
- Preserve the existing 256 KiB record and 4 MiB author-group limits. Do not raise timeouts, reduce acceptance workloads or infer performance acceptance from component tests.
- Qualify real storage/crypto/relay behavior: whole values, different fields, atomic conditions/text, ABA, pending rebase, lost acknowledgments, restart/restore/compaction, founding/relay loss, native lifetime/recovery, generic log paging/retention/device writers, maintained callers and SDK simulation.
- Keep the original record baseline, including the 10,000-record adoption failure, and measure the completed new implementation. Passing narrow tests or choosing this architecture does not complete Cloud acceptance.
