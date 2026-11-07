# Devices that return never override devices that stayed in sync

Proposed: 2026-11-07
Status: Accepted for PS-1116. Amends [PRD 0014](../requirements/platform/0014-local-first-sync.md) R2 and [ADR 0137](0137-order-record-saves-and-declare-collaborative-text.md). The Cloud extension's status states and review popovers ship separately because extensions use only released SDK types.

## Context

A device can be away from a Cloud project in two ways: signed out, or signed in but offline. Before this decision both ended the same way. Signing out stopped the relay but left every project joined, so each save kept a pending envelope forever. One signed-out laptop queued 90,297 saves in a week and then froze an upgrade (PS-1114). When an away device returned, its saves reached Cloud last and won every conflict by relay order, so its deletions removed tickets other devices had edited and its edits revived tickets they had deleted.

The relay is blind, so any conflict rule must be applied identically by every device that reads the stream.

## Decision

1. **Every save carries a base.** For each plain edit, the author records the record lifetime and the write stamps of every path it changes, as its view showed them when saving (`OrderedBase` in `packages/pstdio-sync/src/records/ordered-operation.ts`). A deletion or restore records every stamp of the record. Text-only edits carry no base; declared text still merges as Yjs updates.
2. **In-sync devices win.** Applying a save in relay order skips a path whose stamps moved past its base. A deletion is skipped when anything in the record changed after its base, and an edit is skipped when the record was deleted or recreated. Paths nobody else wrote still apply in relay order. Pending stamps in a base resolve through exact receipts, like conditions, so successive saves from one device chain normally; a base over a refused save is no longer current. Every device computes the same skips, so the relay needs no change. Saves without a base, from before this decision, keep the old rule.
3. **Signing out ends sync.** `pst logout`, a 401 rejection and removing this device all reach the account refresh with no login. Each joined owner then marks itself `signed-out` and folds its unsent saves into one pending save per record. While signed out, held or folded, each new save folds into that record's save, so storage grows with records changed, not with saves. Nothing is deleted locally.
4. **Folding.** A folded save writes the visible value of every path the folded saves changed, where it differs from Cloud's copy, against the earliest base those saves had. It lists the folded saves that may already be in Cloud in `supersedes`; their writes count as part of its base, so a lost acknowledgement never turns a device's own write into a conflict. Folded saves are unconditional. Saves with declared or native text, and every save sharing a record with them, keep their identities because their CRDT history depends on each save. Resource-number (core) saves never fold.
5. **The queue is bounded while signed in.** Past 1,000 unsent saves an owner folds the same way and is marked `folded`.
6. **Large returns wait for review.** When a `signed-out` or `folded` owner next connects, it uploads nothing if its return deletes more than 25 records, changes more than 500, or deletes at least 3 records and half of the owner's records. The owner is `held` until someone applies or discards it on that device. Applying uploads under rule 2. Discarding drops every unsent save and shows Cloud's copy. Remote changes keep arriving while held.
7. **Leaving the account.** Once a signed-in account's project list loads, joined projects it does not sync become local: unsent saves settle locally and the cursor resets. Syncing that project again later joins it like any local project (PRD 0014 R35).
8. **People see what happened.** Project sync status gains `away` (signed-out or held changes, by record and field) and `replaced` (this device's changes Cloud did not apply). `ctx.account.resolveReturnedChanges("apply" | "discard" | "dismiss")` acts on them.

## Consequences

- PRD 0014 R2 changes from "the later ordered write wins" to "the first write to reach Cloud after a save's base wins". Two online devices racing on one field now keep the first save to reach Cloud.
- ADR 0137's "a successful join permanently ends local settlement" still holds while signed in. Signing out does not settle saves locally; it folds them. Leaving the account settles them and ends the join.
- Offline conditional saves keep their conditions until they fold. A folded save loses its condition; the base rule protects most of what the condition guarded, but not every case.
- A device that sends one folded save per record loses the atomicity of multi-record groups it folded.
- Text-heavy editing while signed out still keeps one pending save per text save. That remains unbounded until text folding exists.
- Operation identity rows of folded saves stay, like settled ones, so retries and outcomes resolve.
- Every save is a little larger: one stamp per changed path.

## Alternatives considered

| Option | Trade-off |
| --- | --- |
| Keep relay order (R2 as before) | No metadata, but the device that was away longest wins every conflict. |
| Compare whole records with Cloud on sign-in | No tracking while away, but it cannot tell who changed a field, so stale values overwrite newer ones. |
| Keep queuing while signed out, with a cap | Keeps per-save conditions, but contradicts "sign-out ends sync". |
| A separate changed-field table while away | Equivalent semantics, but needs a second projection overlay and its own upload path. A folded pending save reuses the existing journal, projection and transport. |
| Hold every return for review | Safest, but adds friction to ordinary offline work. |
