# Save related records

Save related changes as one durable group, then read whether the group has synced.

## Availability

`ctx.storage.records` and `ctx.storage.assets` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. Updating `@pstdio/sdk` alone does not add them to your app.

On 0.43.x, save data with `ctx.storage.get`, `set`, `delete`, and `collection`. These calls keep working after the release that adds records. That release marks them deprecated; see [Deprecated structured storage](../../references/sdk/0004-storage.md#deprecated-structured-storage).

The outcome `state` field, optional `expectedRevision`, and the deprecation of the conflict members are on `main`. They ship in the release after 0.44.0. On 0.44.0, read `status` and pass `expectedRevision` on every edit.

## Read a selected page

Indexed queries are additive on `main`, planned for 0.46. Install matching host
and SDK builds before using them. Register deterministic definitions in your
extension definition. The host installs them locally before exposing commands:

```ts
export default defineExtension({
  storageIndexes: [{
    name: "ready-items",
    fields: {
      status: { path: ["status"], type: "string" },
      title: { path: ["title"], type: "string" },
      position: { path: ["position"], type: "string" },
    },
    equality: ["status"],
    orderBy: [{ field: "position", direction: "asc" }],
  }],
});

// In a query command:
const page = await ctx.storage.records.query({
  index: "ready-items",
  where: { field: "status", op: "eq", value: "ready" },
  fields: ["title", "position"],
  limit: 100,
});
const count = await ctx.storage.records.aggregate({
  index: "ready-items",
  where: { field: "status", op: "eq", value: "ready" },
});
```

Each page contains complete record addresses, content revisions and only the
selected fields. Pass `page.cursor` to the same query for the next page. A changed
owner revision invalidates the cursor; restart rather than appending a stale page.
Compare the page and count revisions before displaying them together. Batch full
records with `records.readMany(ids)` when an editor needs them. Keep the batch at
100 addresses or fewer. See [Indexed queries](../../references/sdk/0004-storage.md#indexed-queries)
for null, array, sorting and authorization rules.

Local indexes do not use the synced `storage.migrate` version. Another device
can receive that version without having local indexes. In SDK tests, pass the
same declaration as `createMemoryStorage({ indexes: extension.storageIndexes })`.

## Stage, then save

Stage any new asset before committing the group. Every edit in a group applies
together, or none does:

```ts
const records = ctx.storage.records;
const operationId = ctx.storage.ids.create();
const asset = await ctx.storage.assets.stage({
  operationId: `${operationId}:image`,
  source: selectedImage,
});

const outcome = await records.commit({
  operationId,
  edits: [
    {
      recordId: records.id("note"),
      shared: [{ kind: "text.insert", index: 0, text: "A new observation. " }],
      asset,
    },
    { recordId: records.id("caption"), replace: "Taken during the field visit" },
  ],
});
```

An edit without `expectedRevision` applies to the record's current value on this
device. Pass the `revision` from an earlier `read` only when the save must apply to
exactly what a caller read. Until the deprecated conflict members are removed, a
revision that no longer matches keeps the group aside and reports `needs-attention`
when the edit replaces a value that changed, deletes or restores the record, changes
an asset that changed, or sets a map key that changed. Text and list edits still merge.

## Wait for sync

`outcome.state` is the save's sync state: `saved-locally`, `waiting-to-sync`,
`synced`, `offline`, or `needs-attention`. In a project that does not sync,
`saved-locally` is final. Keep the state visible to the command caller. To wait until a save has
synced, read it again later:

```ts
const latest = await ctx.storage.records.outcome(operationId);
if (latest?.state === "synced") {
  // The relay stored the whole group.
}
```

## Create records and arrange items

`storage.ids.create()`, `migration.id(key)`, and `storage.positions.between()` are
additive APIs on `main`. They ship in the release after 0.44.0.

Use `ctx.storage.ids.create()` for new record IDs and operation IDs. It returns a
random UUIDv7 ordered by its creation millisecond. IDs created within the same
millisecond have no promised order.

Pass a short prefix to select the compact format:

```ts
const recordId = ctx.storage.ids.create("nt");
const operationId = ctx.storage.ids.create("op");
const ticket = await ctx.resources.allocate({ kind: "ticket", idPrefix: "tk" });
```

Both APIs use the same core generator. A compact ID contains the prefix, `_`, and
22 Base62 characters: 25 characters with `tk_`. It preserves all 128 UUID bits,
including the timestamp and 74 random bits. It does not shorten the random field.
Prefixes contain 1 to 16 lowercase ASCII letters or digits and start with a letter.
An empty prefix is invalid. Omit the prefix to keep canonical UUID output.
`resources.allocate` still requires a declared resource kind with a shorthand prefix;
its optional `idPrefix` does not change human references such as `PS-123`.

Compact IDs are case-sensitive. Keep the complete ID unchanged and use exact
comparison for lookups. Normalize human shorthands separately. The encoding alphabet
is `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`; compare with
ordinary `<`, `>` or default string `sort()`, using binary collation in a database.
The time-order promise applies only to random IDs under the same prefix and with
increasing timestamps. Clock rollback can produce an earlier-sorting ID, and device
clocks do not establish a global creation order. Use stored creation times or
positions for product ordering. Mixed UUIDs, prefixes and migration IDs do not form
one chronological sequence.

Prefixes are readable labels, not extension ownership or routing information. Keep
resource owner fields in references. Existing IDs remain unchanged; core extensions
adopt compact IDs separately after their case-sensitive lookup paths are ready.
The format alone does not add a search index or speed up record listing.

When importing data, pass a stable source key to the migration callback's ID helper. The example reads `readLegacy`, which resolves to `undefined` since 0.46. The same pattern applies to any import source:

```ts
await ctx.storage.migrate(1, async (_previousVersion, migration) => {
  const legacy = await ctx.storage.readLegacy("old_notes");
  for (const source of legacy?.records ?? []) {
    if (typeof source.id !== "string") continue;
    const id = migration.id(source.id, "nt");
    await ctx.storage.records.commit({
      operationId: migration.id(`import:${source.id}`, "op"),
      edits: [{ recordId: id, replace: source }],
    });
  }
});
```

The same extension, workbench, scope, migration version and key give the same ID
on every device and on retries. Keep source keys stable. `storage.ids.create()`
still makes random IDs inside a migration; use `migration.id(key)` for imported records.
Existing callbacks that take only the previous version keep working.

Migration IDs use a SHA-256-derived UUIDv8 and the same lossless encoding. The
prefix changes only the text representation, not the hashed namespace or UUID
bits. Keep the key, prefix choice and migration version stable across devices and
retries: switching between omitted and supplied prefixes creates different record
IDs. Migration IDs use no current time, device ID or random input, and have no
creation-time order. Keep existing record IDs when transforming those records;
use `migration.id` when a migration creates records from stable source data.

For lists arranged by hand, store one `position` string on each item's record:

```ts
const first = ctx.storage.positions.between();
const last = ctx.storage.positions.between(first);
const middle = ctx.storage.positions.between(first, last);
const earlier = ctx.storage.positions.between(undefined, first);
```

Omit either neighbour to insert at an end. Compare strings with `<` and `>` or
default string `sort()`. Do not use `localeCompare` or parse positions as numbers.
Positions include the creating device's identity and a random hexadecimal suffix. Concurrent
positions remain distinct, and a new position can fit between them. Existing
positions never need rebalancing; strings can grow as gaps are divided.

Keep each item once, keyed by its stable record ID, and update its position when
moving it. The record merge chooses one position for concurrent moves of the same
item. Sort the resulting records by position on every device.

Tests can simulate the same owner on two devices with
`createMemoryStorage({ workbenchId: "shared", extensionId: "example.notes", deviceId: "device-a" })`
and a second store with the same owner IDs and a different `deviceId`.

## Deprecated conflict members

`records.conflicts`, `records.inspect`, `records.resolve`, the `branch` argument of
`records.read`, and the outcome's `status`, `checkpoint`, `conflictId` and
`conflictRevision` fields are deprecated. Edits are moving to automatic merging, so
there are no conflicts to resolve. Read `state` instead of `status`, and save chosen
values with `commit`. The next breaking release removes these members together. See
[Deprecated conflict members](../../references/sdk/0004-storage.md#deprecated-conflict-members).

## Retry storage, not commands

If a save response is lost, use `outcome(operationId)` or retry that exact storage
request. Keep its ID, any revisions, values, assets, and edit order. Do not retry an
entire command that may already have sent a message, started a process, or changed
an external service. The host's relay adapter retries immutable stored operations.

## Choose the right owner

Use records for extension product data shared within a workbench. Use immutable
assets for referenced versions of bytes. Keep local code, folders, agent
conversations, process state, credentials, and caches with their environment owner;
do not copy them into product records to make them sync.

Use `ctx.workspaceFiles` for the active workspace's files and `ctx.packageFiles`
for shipped code/assets. Extension-owned project drafts and evidence belong under
the allocated extension directory through `ctx.extensionFiles` or artifact mounts.
These file APIs do not add their contents to records.

See the [storage reference](../../references/sdk/0004-storage.md),
[asset workflow](0002-assets.md), and
[allocated extension files](../extensions/0009-allocated-extension-files.md).
