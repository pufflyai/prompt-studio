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
Current query rows overlay immutable pending saves on canonical ordered records.
A durable transaction publishes affected rows, indexes, outcomes and the cursor
together. Declared text history and encrypted receipt pages stay internal to the host.

These methods support local-only workbenches. They do not configure a production
relay or create an account. The internal relay adapter is for host integration;
an extension cannot manufacture an acceptance checkpoint.

## Methods

### IDs, positions and migration identity

These additive APIs are on `main` and ship in the release after 0.44.0.
The [storage declarations](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage.ts)
define their exact types.

| Method | Result |
| --- | --- |
| `storage.ids.create(prefix?)` | A random UUIDv7. An optional prefix selects a lossless, case-sensitive 22-character Base62 body; omitting it returns a canonical UUID. |
| `storage.positions.between(before?, after?)` | A unique position strictly between the supplied neighbours. Omit either end, or both for a first position. |
| `storage.migrate(version, run)` | Runs `run(previousVersion, migration)` once for a scope version. Existing one-argument callbacks remain supported. |
| `migration.id(key, prefix?)` | A UUIDv8 derived from the extension, workbench, scope, target migration version and stable source key. The optional prefix selects the same compact format. |
| `migration.position(rank, key)` | A deterministic initial position for a zero-based nonnegative safe integer rank and stable unique item key. The key separates equal ranks from different offline source lists. Sort source items by stable data before assigning ranks. Use `storage.positions.between` for later insertions and moves. |

`storage.ids.create("tk")` returns `tk_` followed by 22 Base62 characters, retaining
all 128 UUID bits. Prefixes match `[a-z][a-z0-9]{0,15}`; an empty string is invalid.
Without a prefix, both helpers keep canonical UUID output. Keep existing IDs
unchanged. Compact IDs require exact, case-sensitive lookup and binary ordering;
do not lowercase them or use locale sorting. The alphabet is
`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`.

Random IDs sort by encoded millisecond only within the same prefix when timestamps
increase. There is no same-millisecond, clock-rollback or cross-device chronological
guarantee. Migration IDs have no time order. The prefix affects only their encoding;
keep it fixed for every device and retry of a migration. It does not establish
resource ownership. Numbered resources use the same generator through
`resources.allocate({ kind, idPrefix? })`; see [Resource identities](0002-resources.md#resource-identities).

Compare positions with ordinary string comparison (`<`, `>`, or default string
`sort()`), never `localeCompare`. Positions from `between` include device identity
and a random suffix. Concurrent positions remain distinct and divisible without
rebalancing. Store one position per stable item record so concurrent moves merge
to one item. See [Create records and arrange items](../../guides/sdk/0003-storage.md#create-records-and-arrange-items).

### Records

The [public declarations](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage-records.ts)
define the exact types exported by `@pstdio/sdk/extensions`.

| Method | Result |
| --- | --- |
| `id(key)` | Complete opaque record address for a key in the selected storage scope. |
| `read(recordId)` | Value, shared content, asset, deletion state, existence, and opaque revision. |
| `list()` | The owner's current saved records across scopes, excluding tombstones. |
| `defineIndexes(definitions)` | Explicitly install or upgrade the owner's deterministic field/index definitions. |
| `query({ index, where?, fields?, limit?, cursor?, offset?, revision? })` | A bounded selected page with its revision and nullable cursor. |
| `aggregate({ index, where?, groupBy? })` | A count and optional grouped counts at one revision. |
| `readMany(recordIds)` | Up to 100 complete records in input order, including missing records and tombstones. |
| `commit({ operationId, edits })` | Durable outcome for the entire group. `expectedRevision` on an edit is optional. |
| `outcome(operationId)` | The current outcome with its sync `state`, or `undefined` for an unknown operation. |

`conflicts()`, `inspect(conflictId)`, `resolve(proposal)` and the `branch` argument of
`read` are deprecated. See [Deprecated conflict members](#deprecated-conflict-members).

Keep complete record addresses from reads unchanged. Do not strip them to local keys.
Keep revisions opaque. A revision belongs to one record and owner. An edit without
`expectedRevision` applies its changed paths in relay order. Pass `observedRevision`
to derive a replacement from an earlier read without making it conditional. An edit
with `expectedRevision` refuses the whole group if an overlapping path or lifetime
changed before admission, including ABA. Independent siblings remain compatible. Do not replace an earlier caller's revision
with a later read. A missing record has
`exists: false`; deletion retains a tombstone with `exists: true` and
`deleted: true`.

An operation ID is unique within the extension and workbench. Retrying the same ID
requires the same request, including revisions and edit order. Changed content is
rejected. Read the stored outcome after an uncertain response; do not rerun the
extension command.

### Indexed queries

The query and batch methods are additive APIs on `main`, planned for 0.46.
They require an updated host as well as SDK types. Existing `list()` still returns
the complete list; it does not become a paged response.

Declare definitions in `defineExtension({ storageIndexes: [...] })`. The host
installs them on each device before publishing the extension runtime. Registration
replaces that owner's definitions and populates derived data. A query requires an
installed index and never builds one as a side effect. Keep definitions
deterministic across devices. `records.defineIndexes` is the same explicit local
installation operation; do not put local index installation behind the synced
`storage.migrate` version. A second device can receive that version without having
local indexes. Memory fixtures accept `createMemoryStorage({ indexes })`.

The host accepts all index definitions for a runtime in one database transaction.
If any extension's installation fails, the previous runtime keeps its definitions.
If a newer source arrives after acceptance, the accepted candidate owns those
definitions while the host retries the newer load; a failed retry falls back to
that matching candidate rather than the earlier handlers.

Each definition names fields by paths within `record.value`, optional leading
`equality` fields and a fixed `orderBy`. Field types are `string`, `number`,
`boolean` and `array` (strings only). Timestamps use consistently formatted strings.
Selectable fields are not implicitly equality keys. Omitted `equality` means none.
An optional complete-address `prefix` restricts the index to a namespace or
collection. Record methods otherwise cover the whole extension owner across scopes.
The host supplies the owner; callers cannot query another extension or workbench.

Predicates use `{ field, op, value }`, nested `{ all: [...] }`, `{ any: [...] }`,
or `{ not: predicate }`. Negation is the boolean complement, including for missing
and null fields: negating a failed comparison matches those records.
Supported comparisons are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in` and `notIn`.
`contains` tests exact string-array membership or a case-insensitive literal string
substring. `equalsIgnoreCase` compares a string field with a complete string value.
Both string operations use JavaScript's locale-independent `toLowerCase` rule.
Case-insensitive equality does not match missing or null values; `eq` and `ne`
retain their exact comparison semantics. Negate `contains` or `equalsIgnoreCase`
to express negative text filters. `%` and `_` have no wildcard meaning.
`empty`, `notEmpty`, `exists` and
`missing` do not take a value. Empty means missing, null, empty string or empty
array. Equality and grouping combine missing with null; existence predicates
distinguish them. Values with a different declared type are treated as missing.
Ordering predicates reject arrays. `contains` rejects number and boolean fields.

`textContains` searches the JavaScript `String(value)` form of a declared string,
finite number, or boolean field, using locale-independent lowercase and a literal
string needle. It does not match missing, null, or incorrectly typed values.
Numeric text preserves JavaScript's decimal and exponent spelling, including
`1e-7` and `1e+21`; it does not use a database locale or cast through another
floating-point representation. This is scalar text, not a cell formatter: date
labels, custom display labels, and diff summaries need their provider's matching
rules. `contains` keeps its existing string and string-array behavior.

`fields` selects declared field names. Each result has `recordId`, the record's
content `revision`, and a `fields` object; it does not include the complete body,
asset or shared content. Unset selected fields are null. Omit `fields` to select
all declared fields. Use `readMany` when complete selected records are needed.

The page limit is 1–100 and defaults to 100. SQL filters and sorts before the
limit and field materialization. Sorting uses the definition's order, with nulls
last in either direction and a final ascending complete-record-ID tie breaker.
Strings use Unicode code point order, independent of locale. Equality keys use
digests with full-value rechecking. Long-string ordering uses bounded prefixes
and complete comparisons within ties; large equal-prefix groups can still scan
or sort many rows. See [the temporary index limitation](../../adrs/0089-temporary-bounded-query-index-keys.md).
Store the returned opaque cursor unchanged. It binds the owner, index definition,
filter, field selection and owner revision. A changed revision rejects the cursor;
restart at page one instead of combining results from different revisions. Counts
and pages each report their revision so a caller can compare them.

The database maintains only records affected by local commits or received merges,
including named nested types. A normal query, aggregate or batch read uses the
durable projection and does not hydrate the owner's Yjs document. The memory test
API follows the same query behavior with its in-memory data. This read contract
does not establish the separate cold-save and synchronization performance targets.

The host checks that the projection revision matches the authoritative document.
If an older host changes that document without maintaining the projection, reads
and writes fail with an out-of-date projection error. Installing the same index
definitions again explicitly rebuilds the projection. This repair is atomic: a
failed rebuild leaves source records and operation identities intact, and the next
installation can retry it. Normal reads never perform this backfill.

## Edits and outcomes

A record can hold JSON in `value`, one shared primitive, an immutable asset
reference, and deletion state. A group contains at most one edit per record.

Plain JSON preserves string values and object keys, including NUL and lone
UTF-16 surrogates, across memory, indexed and reopened reads. Declared collaborative
text uses Yjs character history and its UTF-8 serialization; keep valid Unicode
text when editing those fields. Revisions remain opaque.

| Edit field | Behavior |
| --- | --- |
| `replace` | Derive changed JSON paths from `observedRevision`, `expectedRevision`, or the current local baseline. Arrays and undeclared strings are whole leaves. |
| `set`, `unset` | Set a JSON Pointer to a value, or remove the named pointers. |
| `observedRevision` | Replacement baseline; does not make the save conditional. |
| `expectedRevision` | Conditional baseline for the entire atomic group. |
| `text` | Insert/delete edits by JSON Pointer for declared text fields. |
| `shared` | Deprecated explicit shared primitive compatibility; use ordinary fields or declared text. |
| `asset` | Select a complete immutable asset reference, or `null` to clear it. |
| `deleted` | Save a tombstone, or restore a deleted record. |

Shared operations are `text.insert`, `text.delete`, `list.insert`, `list.delete`,
`map.set`, and `map.delete`. Text and list positions refer to the content the edit
applies to; later operations in one edit see earlier operations from that edit.
Explicit shared text still merges typing. Shared maps compile to ordinary changed
keys; a shared list is a whole ordered value. Migrate sets to object keys and
hand-arranged lists to stable records with positions. An established shared
primitive does not silently change kind.

Every outcome has the `operationId` and a sync `state`:

| State | Meaning |
| --- | --- |
| `saved-locally` | The complete group is durable on this device. In a project that does not sync, this is final. |
| `waiting-to-sync` | The group is durable on this device and waits to reach the relay. `reason` says why. |
| `synced` | The exact ordered outcome accepted the group. |
| `refused` | An earlier overlapping write or rejected dependency prevented the whole group from applying. |
| `offline` | The group is durable on this device, and the device cannot reach the relay. |
| `needs-attention` | The group is kept on this device but not applied. It needs attention before it can apply or sync. |

Call `outcome(operationId)` again to wait until a save has synced. `synced` does not
mean every device has downloaded the work or its bytes. Required asset bytes must be
complete before a group can sync any member. Use
[`storage.assets`](../../guides/sdk/0002-assets.md) to stage and read those bytes.

Today no save reports `offline`. Cloud projects report it once they sync through the
relay.

## Declared text and append-only logs

These APIs require API 0.4 and a matching SDK and host. Declare only fields people
edit together; ordinary titles, settings and arrays remain ordered values:

```ts
export default defineExtension({
  storage: {
    records: { text: [{ prefix: "note:", fields: ["/description"] }] },
    logs: [{ name: "runs", writer: "project", keep: { days: 30 } }],
  },
});

await ctx.storage.records.commit({
  operationId: ctx.storage.ids.create(),
  edits: [{ recordId: "note:one", set: { "/title": "Release checklist" } }],
});
await ctx.storage.text("note:one", "/description").edit([
  { kind: "text.insert", index: 0, text: "A shared observation. " },
]);
await ctx.storage.log("runs").append({ result: "passed" }, { id: runId });
const newest = await ctx.storage.log("runs").read({ newest: true, limit: 50 });
```

Prefixes match complete record addresses, across scopes. JSON Pointers escape
`/` as `~1` and `~` as `~0`. A text-only facade needs a declared field; record
commits may group text with plain values and one condition. A rejected group's
text cannot return through a native editor delta or full snapshot: affected editor
work stays in private recovery, and a fresh admission starts at canonical history.
Removing a field retires its text history; adding it again starts fresh history.

Logs accept project or device mode. Each device writes only its own device stream;
the logical device log merges streams for reading. Append IDs are immutable: an
identical retry is idempotent and changed content under the same ID is refused.
Reads return entries and opaque cursors. Follow releases subscriptions when its
signal is cancelled. The optional keep.days retention removes expired
payloads through page metadata before fetching their encrypted bodies. A new device loads
only requested pages. Log values do not change the 256 KiB record or 4 MiB record
group limits; keep structured records small and use files for file content.

## Size limits

Records hold small structured data. From extension API 0.3, planned for 0.46, the
host refuses a save that is over either limit:

| Limit | Size | What counts |
| --- | --- | --- |
| `storageLimits.recordBytes` | 256 KiB | UTF-8 bytes of `JSON.stringify({ value, shared })` for one saved record. Asset references do not count. |
| `storageLimits.commitBytes` | 4 MiB | The sum of those sizes for every record in one `commit`, one collection write, or one `set`. |

The size is measured on the record as the save leaves it. A text edit is measured
with the text it adds to, and a deleted record counts as zero. The whole group fails,
and nothing in it is written. Deleting a record is never refused.

The error has `code: "storage_limit_exceeded"` and a `data` object with `limit`
(`"record"` or `"commit"`), the `recordId` for a record, `bytes`, and `maxBytes`.
Its message names the record, its size and the limit. Check it with
`isStorageLimitError(error)` from `@pstdio/sdk/extensions`. The check works across
bundles and through the webview bridge.

The persistent host and `createMemoryStorage` from `@pstdio/sdk/testing` apply the
same limits. Records merged from another device are not refused, so a record can go
over the limit when two devices add to it at the same time. The next local save of
that record must bring it back under the limit.

Store large content as a file and keep its ID or path in the record:
`ctx.storage.files` or the files of a resource scope, `ctx.extensionFiles`, or an
artifact mount. See [Keep records small](../../guides/sdk/0003-storage.md#keep-records-small).

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

The signatures remain available for compatibility: conflicts is empty, inspection
and resolution have no retained branch to select, and the deprecated branch input
does not create another record view. A refused conditional save is reported through
`outcome(operationId).state`, and its exact decision survives compaction and restore.
Save a new operation to express a new choice. Do not reuse an old ID with changed
content or revisions.

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

The optional `workbenchId`, `extensionId`, and `deviceId` settings let tests use the
same logical owner on different devices. Without them, each store has a random
workbench and device ID and uses `test-extension` as its extension ID.

See the [save workflow](../../guides/sdk/0003-storage.md) for examples.

### Direct page navigation

`query` accepts a nonnegative integer `offset` for direct table page jumps. Supply
the previous page's `revision` to reject a jump after the owner changes. Use either
a nonzero offset or a cursor, never both. Cursor continuation remains the preferred
path for adjacent pages. Deep offsets still traverse skipped index entries inside
the database; they do not read skipped record bodies or hydrate the owner document.
