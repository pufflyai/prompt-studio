# Upgrade ordered records and logs

PS-1016 changes the client storage format under [ADR 0134](../../adrs/0134-order-record-saves-and-declare-collaborative-text.md).
The relay remains an encrypted ordered-update and latest-state store. Extension
API 0.4 changes the documented merge behavior and adds explicit text/log declarations.

## Release and extension order

Publish the matching SDK and host through the normal release process before
separately released extensions use `set`, `unset`, `observedRevision`, declared
text or logs. Their API range must include 0.4. Keep the old signatures deprecated
until their coordinated removal. A preview or source-candidate verification does
not publish a package or authorize a release.

Migrate maintained shared-map consumers to ordinary keyed fields. Migrate
hand-arranged lists to stable item records and positions. A plain array is one
ordered value. Declare only collaborative fields as text; multiline strings do
not opt in. Keep file bodies in real files, blobs or declared artifact mounts.
The existing 256 KiB record and 4 MiB author-group limits still apply.

## Local conversion and first connection

The generated database migration adds canonical records, immutable operations,
indexed touches/receipts, log pages and private-history indexes. Do not edit the
SQL, fabricate data-version rows or drop legacy source to force adoption.

Each record owner converts once, under its owner transaction. Ordinary current
values come from SQL; retained tombstones and explicit native sources read their
legacy history. Conversion preserves hidden values/assets/shared content for
restore, original native text genesis and recreated record lifetimes. An error
rolls conversion back; the same original bytes remain available for another
attempt. Initial imports use bounded batches and validate each independent record,
rather than applying the author-group limit to an entire project.

The new record-stream format uses a distinct logical document name. The first full
writer publishes its base and explicitly included eligible pending saves. Other
writers adopt that base, then replay their durable authored envelopes. Their old
local base does not replace the first writer's base. Delivery ACKs do not settle
conditions; only exact ordered outcomes do. Required assets precede admission.

Record-backed native fields use the ordered owner for bind/read/write/export and
editor recovery. Do not reconnect their old native document as another writer.
Those documents remain conversion/recovery input. Actual editable files retain
their existing native owner, source imports and physical-copy reconciliation.

## Personal history and retained logs

The personal-history index becomes typed latest rows plus device-log deltas.
Legacy cached rows are migrated as seed facts in the upgrading device's own
stream, preserving the original record's device ownership. Origin-device changes
and deletions supersede migration seeds regardless of arrival order. Seeds never
resurrect an origin tombstone. Import does not create another device's execution
record or transfer queued-session ownership.

Completed transcripts use generic encrypted device logs with immutable file-backed
payload references. Old pages and files remain migration input. Import bounded
requested history before advancing its durable cursor. Keep account/key-rotation
and terminal-publication fences: completion is announced only after its durable
transcript has an acknowledged delivery. Live session transport remains separate.

New readers load only the log pages they show. Expired payload references are
excluded by metadata before download. A partial reader cannot compact or found a
replacement claiming complete history. Full writers retain required encrypted
receipt/index graph edges and bytes so true relay loss can be repaired.

## Recovery and qualification

When a conditional text group is refused, retain affected editor work privately
before replacing the optimistic view. Its local source generation advances; old
handles, deltas and complete snapshots require fresh admission. Forwarded native
sources carry their unsettled group dependencies, so another host cannot publish
rejected structs as unconditional typing. Empty fields also have distinct genesis
identities across field lifetimes.

A restored pre-admission database must resolve exact retained outcomes before
replaying. Missing receipt pages block reconciliation; a sequence frontier or an
upload acknowledgement is not proof of acceptance. True relay loss starts a new
order only after the normal founding CAS, with known old outcomes respected.

Keep original failures and compare changed-source results with the same workloads.
Qualify SQL/encryption/relay behavior, two-device SDK simulation, native recovery,
maintained callers, 10,000-record adoption and 10-versus-100,000 log append/newest
reads. Complete package consumers, full required tests, independent review and
latest-pushed-head CI before feature acceptance. Component passes and stack-repair
CI remain evidence for their original revisions.
