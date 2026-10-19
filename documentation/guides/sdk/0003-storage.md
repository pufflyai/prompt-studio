# Save related records

Keep a caller's observed revision and save related changes as one durable group.

## Availability

`ctx.storage.records` and `ctx.storage.assets` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. Updating `@pstdio/sdk` alone does not add them to your app.

On 0.43.x, save data with `ctx.storage.get`, `set`, `delete`, and `collection`. These calls keep working after the release that adds records. That release marks them deprecated; see [Deprecated structured storage](../../references/sdk/0004-storage.md#deprecated-structured-storage).

## Capture, stage, save

Read records when opening an edit. Keep those revisions with the draft. Stage any
new asset before committing the group:

```ts
const note = await ctx.storage.records.read(ctx.storage.records.id("note"));
const caption = await ctx.storage.records.read(ctx.storage.records.id("caption"));
const operationId = crypto.randomUUID();
const asset = await ctx.storage.assets.stage({
  operationId: `${operationId}:image`,
  source: selectedImage,
});

const outcome = await ctx.storage.records.commit({
  operationId,
  edits: [
    {
      recordId: note.recordId,
      expectedRevision: note.revision,
      shared: [{ kind: "text.insert", index: 0, text: "A new observation. " }],
      asset,
    },
    {
      recordId: caption.recordId,
      expectedRevision: caption.revision,
      replace: "Taken during the field visit",
    },
  ],
});
```

If either record conflicts, the complete alternative stays retained. Neither
member partially replaces current work. Keep the returned status visible to the
command caller. A local save is useful without a relay; only `synchronized`
includes real relay acceptance.

For an open webview, return the records and revisions from a read command and send
them with a save command. Do not reread current values just to replace the draft's
expected revisions. Two open callers must keep their own observations.

## Resolve a retained group

```ts
if (outcome.status === "conflict") {
  const inspected = await ctx.storage.records.inspect(outcome.conflictId);
  const resolved = await ctx.storage.records.resolve({
    operationId: crypto.randomUUID(),
    conflictId: inspected.conflictId,
    expectedConflicts: inspected.expectedConflicts,
    capturedOperationIds: inspected.capturedOperationIds,
    expectedInputs: inspected.expectedInputs,
    choose: "local",
  });
}
```

Run this after checking `outcome.status === "conflict"` and choosing the branch.
Keep the inspection unchanged while a person decides. A stale resolution preserves
its proposal; inspect again to make a new decision. Edits made after its capture
remain retained separately.

## Retry storage, not commands

If a save response is lost, use `outcome(operationId)` or retry that exact storage
request. Keep its ID, revisions, values, assets, and edit order. Do not retry an
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
These file APIs do not add their contents to the record journal.

See the [storage reference](../../references/sdk/0004-storage.md),
[asset workflow](0002-assets.md), and
[allocated extension files](../extensions/0009-allocated-extension-files.md).

## Declare execution inputs

The execution boundary and handlers below require the unreleased API 0.3 host and SDK.

Commands may declare record addresses known from their parameters:

```ts
const exportNote = defineCommand({
  id: "export-note",
  title: "Export note",
  storageInputs: (_params, records) => [records.id("note")],
  async run(ctx) {
    const note = await ctx.storage.records.read(ctx.storage.records.id("note"));
    return note.value;
  },
});
```

The local host checks these inputs before dispatch and again after middleware
changes the invocation. An unresolved conflict rejects dispatch. Other records
remain usable. Record addresses from other scopes can also be returned.

During commands, hooks, middleware and workspace provider calls, storage reads
stop at unresolved conflicts. This includes legacy KV, collection, attachment and
artifact reads. A conflict discovered after an external effect stops further work;
the host never restarts the invocation or undoes that effect. Use `conflicts()` and
`inspect()` to show accepted state and alternatives. These inspection methods and
explicit `resolve()` remain available to people and agents.

## Optional pure domain merges

An extension can publish optional handlers with its definition:

```ts
export default defineExtension({
  conflictHandlers: {
    mergeLabels: (inspection) => {
      if (inspection.accepted.length !== 1) return null;
      const record = inspection.accepted[0]!;
      if (!Array.isArray(record.value)) return null;
      const values = [record.value, ...inspection.alternatives.flatMap(
        branch => branch.records.filter(item => item.recordId === record.recordId)
          .map(item => item.value),
      )];
      if (!values.every(Array.isArray)) return null;
      return [{ recordId: record.recordId, replace: [...new Set(values.flat())] }];
    },
  },
});
```

Handlers receive only a captured inspection. They must be pure: no host calls,
file writes, network requests, processes or other effects. Return edits for every
captured record exactly once, or `null` when the domain cannot merge it. Invalid
results, unavailable packages and handler failures leave alternatives retained.
Handlers run in declaration order until one proposes edits. Shared sequence edits
preserve captured ancestry. Atomic fields start from the accepted side.

Before dispatch with known conflicted inputs, the authorized local host loads the
handler from the accepted published package bytes. An unpublished development
override cannot supply automatic handlers. The proposal pins that package revision,
handler ID and the inspected conflict and input revisions. A stale or competing
proposal stays retained. The relay checks these guards and never loads extension
code. Automatic handlers require a locally complete published package and a synced
storage scope with the same published revision.

For an explicit domain decision, pass `edits` with the same inspection fields to
`records.resolve()`. Keep `choose` to select the initial side for fields the edits
do not change. Each captured record must appear once. Stage new asset bytes before
proposing them. Explicit decisions do not require an automatic handler.
