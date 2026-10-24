# Blind relay

The blind relay stores and forwards encrypted data for [PRD 0014](../../requirements/platform/0014-local-first-sync.md).
It cannot read project content. Clients encrypt, merge and decide what data means. The relay
keeps one latest state per document and the updates after it, and it checks access, sizes and
quotas from metadata alone.

This replaces the grouped relay in the [synchronization contracts](0026-synchronization-contracts.md).
Clients sync an extension's records through one relay document, the record stream
([ADR 0102](../../adrs/0102-record-stream-sync.md)); to the relay it is an ordinary document.
Clients use the encrypted document protocol. The grouped relay remains for upgrade and
legacy test coverage until PS-824 removes it.

## Protocol

The protocol lives in `packages/pstdio-sync-contracts/src/protocol/` and is part of the package's main export. It uses Zod and the package's shared
identity and SHA-256 schemas.

| Message | Fields |
| --- | --- |
| Update | `updateId`, encrypted `payload`, `blobIds` |
| Latest state | `stateId`, `baseStateId`, `through` (last included update), encrypted `payload`, encrypted `summary`, `blobIds` |
| Blob | `sha256` and `byteLength` of the encrypted bytes, uploaded in numbered parts |
| Live message | `spaceOwner` and encrypted `payload` |

Every other value the relay keeps is routing metadata (R9): project ID, document ID, owner
of private project data, sending device, sizes, times, update IDs, sequence numbers and blob IDs. IDs are
strings of 16 to 128 letters, digits, `_` or `-`. Blob, update and state IDs are random. A
document ID is a keyed hash of the document name, so devices of a space find the same document
while the relay learns nothing about the name. See [Encryption](#encryption).

Every request sends `pstdio-sync-protocol: 1` and `Authorization: Bearer <access token>`. A
different version gets HTTP 426 with `error: "protocol-unsupported"`, the supported versions and
a message that tells the person to update (R29). The token's workbench must be the project in
the path. A path for private project data (a `personal` space in the code) must name the
token's account. Blob ID lists hold at most 100,000 IDs.

| Route under `/sync/projects/~<project>[/spaces/~<owner>]` | Method | Result |
| --- | --- | --- |
| `/documents/~<document>/updates` | POST update | `{ sequence, duplicate }` |
| `/documents/~<document>/read` | POST `{ after }` | Latest state metadata and the updates after `after`, or `state-required` |
| `/documents/~<document>/state` | POST latest state | `{ state }`, or 409 `stale-state` with the current state |
| `/documents/~<document>/states/~<state>` | GET | Encrypted latest-state bytes |
| `/blobs/~<blob>/begin` | POST `{ sha256, byteLength }` | Part size and the parts already stored |
| `/blobs/~<blob>/begin-manifest` | POST `{ sha256, byteLength, children }` | Part size and stored parts; children must already be complete |
| `/capabilities` (project only) | GET | `{ protocolVersion: 1, features: ["blob-references-v1"] }` |
| `/blobs/~<blob>/parts/<n>` | PUT bytes with `pstdio-sha256` and `Content-Length` | `{}` |
| `/blobs/~<blob>/finish` | POST `{}` | `{}` once the full blob is verified |
| `/blobs/~<blob>/read` | POST `{ offset }` | Encrypted bytes from `offset` |
| `/live` (project only) | GET WebSocket | `ready`, `live` and `changed` messages |

Manifest upload requires discovery of `blob-references-v1` first. `createDocumentRelay().manifestBlobs()` performs that discovery and returns an uploader bound to the same project and space. Unknown future feature names are allowed. An old relay or a relay without this feature cannot accept manifests; the client never falls back to an ordinary upload for a manifest. Manifest children are immutable, unique, and limited to 256 opaque IDs. They must already be complete in the same project and space. Ordinary `/begin` accepts no child list.

Manifest downloads require the exact authenticated ciphertext length: `manifestBlobs().get(blobId, byteLength)`. The caller first checks that length against its node size limit. The client rejects a conflicting advertised length before reading the body, reads into a buffer of exactly that size, cancels an oversized stream immediately, and rejects a truncated body. Ordinary blob downloads keep their existing API.

Errors use the `syncErrorSchema` shapes. `missing-blobs` lists blob IDs that an update or latest
state names before they finished uploading (R21).

## Encryption

Clients seal every payload with keys from the account manager before it leaves the device (R8,
R12). The relay never holds keys. [ADR 0085](../../adrs/0085-encrypt-sync-data-with-account-manager-keys.md)
records the key model and its known limit.

- `fetchSyncSpaces` (`pstdio-sync/relay`) reads the project key and the user's private-data key
  from `GET /v1/workbenches/:id/keys` with the device credential. It returns one sync space each.
  The document transport calls it on every synchronization pass, including after access renewal,
  so remaining devices pick up a rotation.
- `sealUpdate`, `sealState`, `sealBlob` and `sealLive` in `packages/pstdio-sync/src/encryption/`
  build the relay envelopes. The matching `open*` functions read them back and throw
  `UnreadableSyncData` when the device lacks the key or the bytes were changed or moved.
- Sealed bytes name their key generation. New data uses the newest generation. Removing a device
  adds a generation, so the removed device cannot read what is written afterward. Older
  generations stay, so remaining devices read older data (R15).
- `space.documentId(name)` gives the relay document ID for a local document name.

## Documents

Each document has a sequence counter. An update gets the next number. An update ID the
document already has returns its first sequence with `duplicate: true` and stores nothing (R27).

A client uploads a new latest state when updates pile up. It names the state it was built on and
the last update it includes. The relay accepts it only if that base is still current, so two
devices cannot replace each other's work (R18). A retry of the current state succeeds again.

Reading returns the current latest state's metadata, including its encrypted summary, and up
to 1,000 updates or 8 MiB after `after`. Read again while `more` is true. When the relay already
removed updates the client still needs, the read answers `state-required`, and the client
downloads the latest state and reads the updates after its `through`.

## Grace period and cleanup

Accepting a latest state keeps the state it replaces, and the updates after that state, for the
grace period (R20). A device that has the replaced state can still catch up with updates, and a
broken upload can be repaired from that copy. Anything older is already inside the replaced
state, so the relay removes it at once. Cleanup removes the replaced state and its updates when
the grace period ends.

So a document holds its latest state, the updates after it, and one grace-period copy: the
replaced state and the updates after it. Clients upload a new state once the updates after the
latest one pass a size limit, so storage stays below twice the latest state plus the
grace-period copy (R23).

A blob stays while any stored update or latest state lists it, directly or through immutable manifest children. A staged parent protects its children within the existing upload grace. When the last such row goes, the
blob's grace period starts. An offline device's edit that uses the blob within that time is
accepted (R21). Unfinished uploads are removed after the grace period too.

The relay runs cleanup when it starts and then every hour. Cleanup is safe to repeat and to run
on several replicas.

## Storage

PostgreSQL keeps metadata, sequence numbers and the replace-only-if-current check
(`services/relay/src/storage/document-schema.ts`). It also keeps each latest state's encrypted
summary, at most 64 KiB, so clients can compare it without a download. Object storage keeps the
update, latest-state and blob bytes (R47).

Update and state objects get a new random key on each write, so a retry or a lost race never
overwrites stored bytes. When a row goes away, or a write is refused or ignored, its object key
goes to a deletion queue. Cleanup deletes a queued object only when no row points at it. A write
whose commit reply was lost may have stored its row, and its bytes stay.

Blobs reuse the verified multipart asset owner in `services/relay/src/assets`. Each blob is its own
asset owner, so two blobs with equal ciphertext never share stored bytes.

Writes from one account run one at a time under a PostgreSQL advisory lock. That makes the
quota check exact and keeps cleanup from removing a blob while an update starts to use it.

## Limits

Operators set limits through environment variables. Defaults are in `services/relay/src/limits.ts`.

| Variable | Default |
| --- | --- |
| `RELAY_GRACE_PERIOD_SECONDS` | 7 days |
| `RELAY_MAX_UPDATE_BYTES` | 1 MiB |
| `RELAY_MAX_STATE_BYTES` | 64 MiB |
| `RELAY_MAX_SUMMARY_BYTES` | 64 KiB |
| `RELAY_MAX_BLOB_BYTES` | 5 GiB |
| `RELAY_MAX_LIVE_MESSAGE_BYTES` | 64 KiB |
| `RELAY_ACCOUNT_QUOTA_BYTES` | 50 GiB |
| `RELAY_MAX_READ_BYTES` | 8 MiB |
| `RELAY_REQUESTS_PER_SECOND` and `RELAY_REQUEST_BURST` | 50 per second, bursts of 500, per device |

Over a size limit returns 413, over the quota 507 and over the rate 429.

## Access

Project IDs are unique only within one account. The relay keys every project by a hash of the
token's account and project IDs, so two accounts that use the same project ID never share
documents, blobs or live traffic. Phase 1 has one user per account, so the owner of private
project data is an account ID. Team accounts (PS-829) add a user claim to access tokens.

## Live traffic

Devices of one project connect to `/live`. A `live` message goes to every other device in the
project that can read its space. It is never stored (R31). After an update or latest state commits,
the relay sends `changed` with the document ID, last sequence and latest state ID. A malformed
message, a message for another user's space, or an expired token closes the socket with 1008.
A slow consumer or a device over its rate is closed with 1013 and reconnects.

The relay forwards between connections of one process. It runs as one instance (R47).

## Logs

Failures report only fixed codes through the service diagnostics adapter (R11, PS-785). Request
bodies, IDs and errors never reach logs or reports.

## Known limits

- A crash between storing bytes and committing their row leaves an object that cleanup does not
  find.
- Quota checks sum the account's stored bytes on every write. Summaries are not counted.
