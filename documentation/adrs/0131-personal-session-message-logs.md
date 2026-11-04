# Personal session history as message logs

Proposed: 2026-11-01
Status: Accepted. Index and preview routing decisions superseded by [ADR 0133](0133-sync-session-index-changes-by-device.md).

## Context

Personal history has one writer per session. Keeping each transcript in a Yjs replica stored live output, repeatedly copied whole conversations, and rebuilt sync state on every access renewal. The runtime reached tens of gigabytes in PS-977. Every device must still keep all completed conversations available offline.

## Decision

Keep session and workspace summaries in a small encrypted CRDT index. Publish completed messages to append-only logs using the relay's existing ordered document updates. A message's ID identifies later corrections; its position preserves conversation order. Logs never publish a latest state. Oversized messages use encrypted blobs referenced by small encrypted updates. Durable HTTP sync and relay storage remain unchanged. Live snapshots use live protocol 2 from ADR 0130, on one opaque private-space topic; the retired broadcast transport is removed.

Persist canonical message fingerprints and the last published log head locally. Compare unchanged live message objects through weak references so sync never retains a second transcript. On startup, unchanged saved sessions do not load their conversations. Access renewal preserves sync objects and cursors, while refreshing keys and checking the index for missed changes.

Copy other devices' new log entries page by page. Each local page filename records its relay cursor; atomic rename commits content and position together. A replay replaces the same page and message IDs. No completed transcript stays in the receiving sync process. Reading a conversation materializes its local pages only when requested.

Send streaming messages through the encrypted, unstored live channel. Coalesce updates every 250 ms across sessions and fragment full snapshots within the relay's 64 KiB wire limit. Never truncate text. A completed log message supersedes any delayed preview.

Store log heads in the index in batches, at most once per ten seconds during continuous publication. Only the small index and shared-reference documents retain relay subscriptions. Completed-session logs catch up from the durable index heads, so the number of historical sessions never consumes live subscription capacity. Nonterminal heads keep the existing ten-second batch; captured terminal metadata flushes its completed head immediately. All document owners share one live connection per project; each owner runs and retries independently. Rate-limited HTTP requests honor Retry-After and cancel with their connection attempt.

Use a new index identity and relay name. Each upgraded device publishes its own sessions once. Drop old local transcript documents and journals without reading their content. Devices that never upgrade do not contribute to the new index. Existing first-account ownership claims still prevent publication to another account.

A terminal session carries a small publication acknowledgment in the same encrypted index: its status/update version and the acknowledged durable log position, including zero for an empty conversation. A follower sends its terminal event only when that version still matches and its local cursor has reached the position. It rechecks the version after disk reads and the final snapshot write. The index can arrive before the log without ending the stream early. This adds no document, subscription, or relay protocol version.

Live publication uses the same captured account/project ownership as durable logs. Events received before ownership is known are retained as IDs; capture and private-topic admission catch up the current resident preview without another chunk. Key preparation exposes a space only after its identifiers and generation are committed.

Queued follow-up messages that have not started are shared as a separate index record per session, only while the queue has requests. Saving messages rewrites the session record but not its queue. The record carries each request's position, revision, model and a 500-character preview, at most 50 requests. Offline devices show these incomplete previews read-only. Online queue editing reads complete requests from the owning device through the normal API and sends revision-checked remote commands. A replicated preview only signals a refresh; it never replaces editable request data.

## Consequences

Every device still stores every completed conversation of its user's Cloud projects. Sync memory follows new messages and small cursors, rather than all downloaded history. Disk use follows completed history. Logs deliberately retain old message revisions.

Legacy relay ciphertext is no longer read or updated. The current relay has no individual document-delete API, so that ciphertext remains until its space is deleted. This does not affect startup or sync memory.

Personal history remains owned by its source device. Online remote session actions use the normal API forwarding path and never move execution ownership. Pending approvals travel in the existing encrypted session index and shared stream; only the source approval service resolves or expires them. Offline readers keep history and previews, with remote actions unavailable. Team sharing and journal paging for ordinary CRDT documents remain separate work.

## Validation

Publisher and receiver tests cover completed-only persistence, corrections, encrypted large messages, restart cursors, and offline reads. Live tests cover full Unicode snapshots, wire size, and delayed previews. Live-channel tests cover shared routing, subscription admission and access renewal. Packaged smoke coverage exercises compiled devices and offline restart.
