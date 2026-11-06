# Personal history's device-log projection

Personal history uses the append transport from [ordered storage](0019-ordered-storage-upgrade.md) while preserving its existing private ownership, interested-only live previews and incremental session capture. The private index stores each device's latest metadata rows. Public extension logs keep their complete immutable entry history.

## Persistence

| Store | Responsibility |
| --- | --- |
| `storage_log_entries` | Immutable local index appends and exact prepared encrypted deliveries, durable before POST. |
| `storage_personal_history_sources` | Each writer's canonical current contributions, including tombstones and seed provenance. Only ordered input or its exact delivery acknowledgment updates these rows. |
| `storage_personal_history` | The current private index projection. `pending_id` preserves a newer local edit when an older append settles. Normal origin-device contributions supersede migration seeds. |
| `storage_personal_history_positions` | Covered positions per writer, committed with canonical contributions and affected projected rows. |

SQL owns the index. Its local row cache preserves unchanged object identities and invalidates a kind only when its visible values change. Heads, terminal publication proofs and provenance-only changes keep the visible revision unchanged. This preserves the personal reader's parsed-row cache and avoids whole-index announcements for transcript progress.

## Transport and snapshots

The internal adapter is [index-projection-sync.ts](../../../packages/pstdio-api/src/services/personal-history/index-projection-sync.ts). It uses `pstdio-sync/logs`' shared encrypted batch preparation, immutable payload references and durable envelopes. Its device-specific document name and encrypted `device-index-projection` snapshot format are distinct from the public append-log format. The blind relay protocol is unchanged.

A publish captures the pending prefix once. Entries appended while POST is in flight stay pending for the next publish. When an acknowledgment arrives, SQL records its canonical contribution without replacing a newer local pending value.

After 1,000 updates, the writer can publish a snapshot of its canonical current rows and tombstones. Snapshot leaves hold at most 100 contributions; branches reference at most 128 child blobs. A fresh reader restores those pages and continues after the snapshot's covered position. It does not replay superseded metadata changes. Snapshot construction excludes later optimistic edits and retains deletion authority against delayed migration seeds.

Only the writer snapshots or refounds its device stream. A writer restoring lost relay data uses its covered canonical contributions and starts the next relay sequence after that logical prefix. Missing or invalid snapshot data blocks synchronization. Downloaded graph edges are retained only after validating the decrypted page.

This derived projection does not add a public log mode, reducer callback or retention exception. Ordinary extension logs continue to retain all immutable entries except those removed by their declared retention policy.

## Upgrade input and transcript files

Upgrade reads the earlier `logs-v1` index document and the existing `index-*.pages` files using their original entry schema. File pages are folded incrementally into current contributions. The upgrading device publishes those contributions as seeds in its own stream, retaining each row's original account and device. Origin updates and tombstones supersede seeds regardless of arrival order. Seed selection is deterministic across cached copies. Original documents and files remain available after conversion.

Transcripts use the same generic encrypted append transport through a file-backed payload adapter. SQL holds immutable file pointers, while large payload files remain under the existing account/project namespace. Legacy transcript pages stay readable. Generic pages become visible only after their durable page is named by the atomically replaced cursor file; appending a page and reading its position do not enumerate earlier pages. Terminal completion checks the publication's version, covered head and transcript format.

Live previews, reader registration, publication serialization, incremental capture and session execution ownership retain their existing host contracts. Migrating data kinds does not start a CPU experiment or change a session's execution device.
