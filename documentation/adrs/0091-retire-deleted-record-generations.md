# Retire deleted record generations

Proposed: 2026-10-22

Status: Accepted

## Problem

Removing a record's visible reference leaves its named child payload in Yjs.
Reusing those names on explicit restore also lets an old offline edit change the
restored record. A deletion must hide and reclaim the deleted payload while
retaining the causal history needed to merge an arbitrarily late update.

## Decision

Keep the owner document and existing first-creation names. On deletion, record
the current root name in a permanent `retired-records` map. Clear payload in that
root's named descendants through ordinary Yjs deletes. Keep Yjs identifiers,
delete sets, root names and retirement entries. Never replace the document with
a fresh JSON import or remove tombstones.

An explicit restore after deletion uses a root name derived from the record ID
and restore operation ID. Its descendants therefore belong to a new generation.
Old offline updates still merge, but edits to a retired generation cannot change
the new one. The normal operation ledger preserves retry identity.

Maintain an in-memory index from named types to their generation. Add newly seen
types incrementally. Cleanup visits changed retired generations, not every owner
or live record. Upgrade may scan existing names once and retire legacy deleted
roots while rebuilding the projection atomically.

## Older writers

Existing offline updates keep their original identities and names. A legacy
deletion without retirement metadata retires the original root on receipt. A
legacy explicit restore that points to that same root remains readable with its
existing merge semantics; cleanup never clears the currently live root. New
hosts use separate restore generations. Database projection revision checks
reject stale rows after an older local host writes without maintaining them.

## Costs

Retirement entries and CRDT causal metadata grow with deletion history. They are
required for late offline devices and are reported separately from live payload.
Some existing list identities include the original JSON value in their names.
Those names can retain substantial bytes after their live contents are cleared;
cleanup does not remove that causal metadata or promise to erase its text.
This change reclaims document payload; it does not change immutable asset or
relay retention policy. Initial ownership indexing remains proportional to the
document's named types and belongs to hydration or explicit upgrade work.
