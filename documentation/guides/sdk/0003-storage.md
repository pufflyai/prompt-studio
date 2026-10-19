# Save related records

Save related changes as one durable group, then read whether the group has synced.

## Availability

`ctx.storage.records` and `ctx.storage.assets` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. Updating `@pstdio/sdk` alone does not add them to your app.

On 0.43.x, save data with `ctx.storage.get`, `set`, `delete`, and `collection`. These calls keep working after the release that adds records. That release marks them deprecated; see [Deprecated structured storage](../../references/sdk/0004-storage.md#deprecated-structured-storage).

The outcome `state` field, optional `expectedRevision`, and the deprecation of the conflict members are on `main`. They ship in the release after 0.44.0. On 0.44.0, read `status` and pass `expectedRevision` on every edit.

## Stage, then save

Stage any new asset before committing the group. Every edit in a group applies
together, or none does:

```ts
const records = ctx.storage.records;
const operationId = crypto.randomUUID();
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
