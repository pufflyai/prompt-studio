# Grouped storage

Save related records together and read the sync state of each save.

## Availability

`ctx.storage.records`, `ctx.storage.assets`, `ctx.storage.migrate`, and `ctx.storage.readLegacy` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. In 0.43.1, `get`, `set`, `delete`, and `collection` are the supported storage methods and are not deprecated.

An extension that uses these methods needs a Prompt Studio app from that release. Updating `@pstdio/sdk` alone gives you the types but not the host methods. See [App, SDK, and extension API versions](../extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

The outcome `state` field, optional `expectedRevision`, and the deprecation of the conflict members are on `main`. They ship in the release after 0.44.0. On 0.44.0, read `status` and pass `expectedRevision` on every edit.

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
| `read(recordId)` | Value, shared content, asset, deletion state, existence, and opaque revision. |
| `list()` | The owner's current saved records across scopes, excluding tombstones. |
| `commit({ operationId, edits })` | Durable outcome for the entire group. `expectedRevision` on an edit is optional. |
| `outcome(operationId)` | The current outcome with its sync `state`, or `undefined` for an unknown operation. |

`conflicts()`, `inspect(conflictId)`, `resolve(proposal)` and the `branch` argument of
`read` are deprecated. See [Deprecated conflict members](#deprecated-conflict-members).

Keep complete record addresses from reads unchanged. Do not strip them to local keys.
Keep revisions opaque. A revision belongs to one record and owner. An edit without
`expectedRevision` applies to the record's current value on this device. An edit with
one applies to the value the caller read. Do not replace an earlier caller's revision
with a later read. A missing record has
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
| `replace` | Replace the whole JSON value. |
| `shared` | Ordered text/list/map operations on the record's shared content. |
| `asset` | Select a complete immutable asset reference, or `null` to clear it. |
| `deleted` | Save a tombstone, or restore a deleted record. |

Shared operations are `text.insert`, `text.delete`, `list.insert`, `list.delete`,
`map.set`, and `map.delete`. Text and list positions refer to the content the edit
applies to; later operations in one edit see earlier operations from that edit.
Sequence edits merge, and independent map keys merge. An established shared
primitive does not silently change kind.

Every outcome has the `operationId` and a sync `state`:

| State | Meaning |
| --- | --- |
| `saved-locally` | The complete group is durable on this device. In a project that does not sync, this is final. |
| `waiting-to-sync` | The group is durable on this device and waits to reach the relay. `reason` says why. |
| `synced` | The relay stored the group. |
| `offline` | The group is durable on this device, and the device cannot reach the relay. |
| `needs-attention` | The group is kept on this device but not applied. It needs attention before it can apply or sync. |

Call `outcome(operationId)` again to wait until a save has synced. `synced` does not
mean every device has downloaded the work or its bytes. Required asset bytes must be
complete before a group can sync any member. Use
[`storage.assets`](../../guides/sdk/0002-assets.md) to stage and read those bytes.

Today no save reports `offline`. Cloud projects report it once they sync through the
relay.

## Deprecated conflict members

Edits from several devices are moving to automatic merging, so there are no
conflicts to inspect. These members are deprecated and are removed together in the next
breaking release:

| Deprecated | Replacement |
| --- | --- |
| `records.conflicts()` | None. `outcome(operationId)` reports a save that needs attention. |
| `records.inspect(conflictId)` | None. |
| `records.resolve(proposal)` | Save the chosen values with `commit`. |
| `records.read(recordId, branch)` | `read(recordId)`. |
| Outcome `status`, with `checkpoint`, `conflictId` and `conflictRevision` | Outcome `state`. |
| `StorageConflict`, `StorageConflictInspection`, `StorageResolution` | None. |

Until then they keep working. A stale `expectedRevision` still keeps the whole group as
an alternative instead of applying it when the edit replaces the JSON value, deletes or
restores the record, changes its asset, or sets a map key that changed. Its outcome has
`status: "conflict"` and `state: "needs-attention"`. Stale text and list edits, and edits
to other map keys, still merge. The old `status`
values map to `state` like this: `saved-locally` to `saved-locally`, `pending` to
`waiting-to-sync`, `synchronized` to `synced`, and `conflict` to `needs-attention`.

Until removal, resolution works as before. Use `inspect` when a person or command is
ready to choose a complete branch. Pass
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
Their replacements are `records.read` and `records.commit` calls. These
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
same record rules. Seeds are ready before the first read. Each
instance has an isolated owner. It is an in-memory test adapter and provides no
relay acknowledgment. Real database tests cover durable process restart. In
`@pstdio/sdk` 0.43.1, `createMemoryStorage()` takes no options and has no records.

See the [save workflow](../../guides/sdk/0003-storage.md) for examples.
