# Grouped storage

Save related records together, keep the revision a caller read, and retain competing work for explicit resolution.

## Availability

`ctx.storage.records`, `ctx.storage.assets`, `ctx.storage.migrate`, and `ctx.storage.readLegacy` are available in the published `@pstdio/sdk` 0.44.0 release and require host API 0.2.0. The [published package](https://registry.npmjs.org/@pstdio/sdk/-/sdk-0.44.0.tgz) includes their declarations. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. In 0.43.1, `get`, `set`, `delete`, and `collection` are the supported storage methods and are not deprecated.

An extension that uses these methods needs a Prompt Studio 0.44.0 app or later. Updating `@pstdio/sdk` alone gives you the types but not the host methods. See [App, SDK, and extension API versions](../extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

## Ownership and durability

`ctx.storage.records` belongs to the current extension and workbench. The host
chooses that owner. `records.id(key)` creates a stable complete address in the
selected storage scope. `storage.scope({ type: "project" })` returns to the project
scope. All record methods use complete addresses and cover the entire owner.
One group can include records from several scopes.

A local save persists the complete operation in the database before returning.
Current records are derived from accepted state and the ordered local journal.
Receiving accepted work preserves pending operations and an open caller's captured
revision. Text and list documents stay internal to the host.

These methods support local-only workbenches. They do not configure a production
relay or create an account. The internal relay adapter is for host integration;
an extension cannot manufacture an acceptance checkpoint.

## Methods

The [public declarations](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage-records.ts)
define the exact types exported by `@pstdio/sdk/extensions`.

| Method | Result |
| --- | --- |
| `id(key)` | Complete opaque record address for a key in the selected storage scope. |
| `read(recordId, branch?)` | Value, shared content, asset, deletion state, existence, and opaque revision. An optional `{ operationId }` reads retained branch work. |
| `list()` | The owner's current saved records across scopes, excluding tombstones. |
| `commit({ operationId, edits })` | Durable outcome for the entire group. Every edit supplies its caller-observed `expectedRevision`. |
| `outcome(operationId)` | The current durable outcome, or `undefined` for an unknown operation. |
| `conflicts()` | Unresolved conflict identities, revisions, reasons, record IDs, and alternative operation IDs. |
| `inspect(conflictId)` | Current inputs, complete alternatives, ancestry, and the exact capture needed for resolution. |
| `resolve(proposal)` | Outcome for a replacement of exactly the inspected capture. |

Keep complete record addresses from reads and conflict inspections unchanged.
Do not strip them to local keys. Keep revisions opaque. A revision belongs to one record and owner. Do not replace
it with a later read when saving an earlier caller's work. A missing record has
`exists: false`; deletion retains a tombstone with `exists: true` and
`deleted: true`.

An operation ID is unique within the extension and workbench. Retrying the same ID
requires the same request, including revisions and edit order. Changed content is
rejected. Read the stored outcome after an uncertain response; do not rerun the
extension command.

## Edits and outcomes

A record can hold JSON in `value`, one shared primitive, an immutable asset
reference, and deletion state. A group contains at most one edit per record.

| Edit field | Behavior |
| --- | --- |
| `replace` | Replace the whole JSON value. A competing replacement retains the whole alternative. |
| `shared` | Ordered text/list/map operations based on the captured revision. |
| `asset` | Select a complete immutable asset reference, or `null` to clear it. Competing versions retain alternatives. |
| `deleted` | Save a tombstone or restore from an observed tombstone. Concurrent delete/edit work is retained. |

Shared operations are `text.insert`, `text.delete`, `list.insert`, `list.delete`,
`map.set`, and `map.delete`. Text and list positions refer to the observed content;
later operations in one edit see earlier operations from that edit. Sequence edits
merge, and independent map keys merge. Competing map-key changes retain the entire
group. An established shared primitive does not silently change kind.

| Status | Meaning |
| --- | --- |
| `saved-locally` | The complete group is durable in a local-only workbench. |
| `pending` | Work is durable and awaits relay acceptance or a dependency. |
| `synchronized` | The relay durably accepted this operation at the returned checkpoint. |
| `conflict` | The complete proposal is retained with a conflict ID and revision. |

`synchronized` does not mean every client has downloaded the work or its bytes.
Unrelated records continue while another group waits or conflicts. Required asset
bytes must be complete before a group can publish any member. Use
[`storage.assets`](../../guides/sdk/0002-assets.md) to stage and read those bytes.

## Conflict resolution

Use `inspect` when a person or command is ready to choose a complete branch. Pass
its `expectedConflicts`, `capturedOperationIds`, and `expectedInputs` back unchanged.
The inspection includes valid pending local saves and their current conflict
revisions, even when the relay first reported the conflict. A fresh choice uses
the same local view as its validation.
Revision guards also retain resolved ancestors required by the captured branch.
Those historical guards do not appear as active conflicts.
Choose `local` for the captured alternative or `remote` for current values.
Text/list changes from the captured branch still merge when choosing current JSON
and assets. A primitive-kind collision must keep the established primitive.

A stale input, conflict revision, or published handler revision keeps the proposal
as an alternative. It does not overwrite current work. A later edit outside the
explicit capture remains available for another resolution. Previous branches stay
retained until the replacement is accepted. Local-only resolution remains usable
and returns `saved-locally`, never a relay acknowledgment.

## Deprecated structured storage

`get`, `set`, `delete`, and collection replacement methods remain supported.
Their replacements are `records.read` and guarded `records.commit` calls. These
old calls now use the same durable owner. Existing KV and collection rows are
imported and removed atomically on first access; there is no second writable copy.

KV keys correspond to `records.id(key)` in the same storage scope. Legacy `set` observes
the latest local value inside the owner transaction and replaces it. It has no
caller-provided revision and does not protect an earlier read-modify-write.
Collection `update`, `createIfAbsent`, and `deleteIfValue` keep their local atomic
conditions. Their boolean result is not a distributed lease.

Legacy collections retain their own names and ordering. Continue their supported
access while planning an explicit extension data migration to domain record IDs.
Do not change stored data formats merely by renaming method calls. Blob files and
collection attachments also keep their existing contract; asset references are a
separate contract.

## Test storage

`createMemoryStorage({ kv?, collections? })` from `@pstdio/sdk/testing` uses the
same record and conflict rules. Seeds are ready before the first read. Each
instance has an isolated owner. It is an in-memory test adapter and provides no
relay acknowledgment. Real database tests cover durable process restart. In
`@pstdio/sdk` 0.43.1, `createMemoryStorage()` takes no options and has no records.

See the [save workflow](../../guides/sdk/0003-storage.md) for examples.
