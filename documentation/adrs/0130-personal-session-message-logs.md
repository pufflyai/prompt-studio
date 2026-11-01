# Personal session history as message logs

Proposed: 2026-11-01
Status: Accepted

## Context

Personal history has one writer per session. Keeping each transcript in a Yjs replica stored live output, repeatedly copied whole conversations, and rebuilt sync state on every access renewal. The runtime reached tens of gigabytes in PS-977. Every device must still keep all completed conversations available offline.

## Decision

Keep session and workspace summaries in a small encrypted CRDT index. Publish completed messages to append-only logs using the relay's existing ordered document updates. A message's ID identifies later corrections; its position preserves conversation order. Logs never publish a latest state. Oversized messages use encrypted blobs referenced by small encrypted updates. The relay protocol and schema remain unchanged.

Persist canonical message fingerprints and the last published log head locally. Compare unchanged live message objects through weak references so sync never retains a second transcript. On startup, unchanged saved sessions do not load their conversations. Access renewal preserves sync objects and cursors, while refreshing keys and checking the index for missed changes.

Copy other devices' new log entries page by page. Each local page filename records its relay cursor; atomic rename commits content and position together. A replay replaces the same page and message IDs. No completed transcript stays in the receiving sync process. Reading a conversation materializes its local pages only when requested.

Send streaming messages through the encrypted, unstored live channel. Coalesce updates every 250 ms across sessions and fragment full snapshots within the relay's 64 KiB wire limit. Never truncate text. A completed log message supersedes any delayed preview.

Store log heads in the index in batches, at most once per ten seconds during continuous publication. Relay hints wake only the owners that claim the changed document. All document owners share one live connection per project; each owner runs and retries independently. Rate-limited HTTP requests honor Retry-After and cancel with their connection attempt.

Use a new index identity and relay name. Each upgraded device publishes its own sessions once. Drop old local transcript documents and journals without reading their content. Devices that never upgrade do not contribute to the new index. Existing first-account ownership claims still prevent publication to another account.

## Consequences

Every device still stores every completed conversation of its user's Cloud projects. Sync memory follows new messages and small cursors, rather than all downloaded history. Disk use follows completed history. Logs deliberately retain old message revisions.

Legacy relay ciphertext is no longer read or updated. The current relay has no individual document-delete API, so that ciphertext remains until its space is deleted. This does not affect startup or sync memory.

Personal history remains read-only on other devices. Remote commands, team sharing, and journal paging for ordinary CRDT documents are separate work.

## Validation

Publisher and receiver tests cover completed-only persistence, corrections, encrypted large messages, restart cursors, and offline reads. Live tests cover full Unicode snapshots, wire size, and delayed previews. Connection tests cover shared routing and access renewal. Packaged smoke coverage exercises compiled devices and offline restart.
