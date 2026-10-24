# Data migrations

Extensions own the versions and transformations of their stored data. Core provides these public helpers on `ctx.storage`.

## Availability

`ctx.storage.migrate`, `ctx.storage.readLegacy`, and the `legacyData` option of `createMemoryStorage` are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them; in 0.43.1, `createMemoryStorage()` takes no options. Updating `@pstdio/sdk` alone does not add these methods to your app. See [App, SDK, and extension API versions](0014-api-versioning.md#app-sdk-and-extension-api-versions).

## Run a migration

```ts
await ctx.storage.migrate(2, async (previousVersion) => {
  if (previousVersion < 1) {
    const legacy = await ctx.storage.readLegacy("old_notes");
    for (const record of legacy?.records ?? []) {
      if (typeof record.id !== "string") continue;
      await ctx.storage.collection("notes").createIfAbsent(record.id, record);
    }
  }
  if (previousVersion < 2) {
    // Transform this extension's version-one records here.
  }
});
```

The version must be a positive safe integer. Each extension instance and storage scope has its own checkpoint. Concurrent calls serialize. An equal version skips the callback; a newer stored version reports an error instead of running older code. Only a successful callback advances the checkpoint.

Call the helper before accessing the extension's data. Use the same migration entry point from each command or hook that needs that data. Other extensions and core navigation remain available.

The helper does not roll back callback writes. Make each step safe to retry and preserve newer user data with conditional creation. Do not call `migrate` recursively on the same storage scope.

On `main`, the callback also receives `migration` as its second argument. Use
`migration.id(sourceKey)` for records created by a migration. It derives the ID
from the extension, workbench, storage scope, target version and stable key, so
two devices and failed retries create the same records. Existing one-argument
callbacks keep working. `storage.ids.create()` always returns a random ID.
Pass an optional prefix, such as `migration.id(sourceKey, "nt")`, for a lossless
22-character Base62 body. Keep that prefix choice fixed across devices and retries;
changing it changes the record ID. Migration IDs hash stable inputs without using
the current time and do not sort by creation time. Existing record IDs stay unchanged.
These additions ship in the release after 0.44.0. See the
[ID and ordering guide](../../guides/sdk/0003-storage.md#create-records-and-arrange-items).

## Read retained source records

Since 0.46 the host starts with a new database and keeps no retained tables, so it always resolves to `undefined` ([ADR 0103](../../adrs/0103-database-baseline-replaces-in-place-upgrades.md)). Older data is in the JSON export under `~/.pstdio/backups/`.

Before 0.46, `readLegacy(source)` returned `{ version, records }` or `undefined`. The version named the schema immediately before the table was removed. Records keep their original column names and JSON values. Your extension validates and interprets them.

The host read only retained tables and filtered records to the invoking project. A record with an existing extension instance owner is visible only to that instance. This API cannot read active tables, global records, or another project's data.

The host retained the source after import and failure. Reading it does not acknowledge, delete, or transfer it. Existing project file IDs can be read with `ctx.files.readText`; imported content uses the ordinary extension attachment API.

## Test migration code

`createMemoryStorage({ legacyData: { old_notes: { version: "old-schema", records: [...] } } })` from `@pstdio/sdk/testing` supplies retained-data fixtures. It implements scope-local migration versions and returns copies of source records. Test first import, retry after a partial write, newer-data preservation, and repeated calls.

See [ADR 0077](../../adrs/0077-extension-owned-data-migrations.md) for storage ownership and retention.
