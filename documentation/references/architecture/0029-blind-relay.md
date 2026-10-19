# Blind relay

The blind relay stores and forwards encrypted data for [PRD 0014](../../requirements/platform/0014-local-first-sync.md).
It cannot read project content. Clients encrypt, merge and decide what data means. The relay
keeps one latest state per document and the updates after it, and it checks access, sizes and
quotas from metadata alone.

This replaces the grouped relay in the [synchronization contracts](0026-synchronization-contracts.md).
Both run side by side until the client sync and encryption work (PS-819, PS-821, PS-822) moves
clients to the new protocol. PS-824 then removes the grouped relay.

## Protocol

The protocol lives in `pstdio-sync-contracts/protocol`. It uses Zod and the package's shared
identity and SHA-256 schemas.

| Message | Fields |
| --- | --- |
| Update | `updateId`, encrypted `payload`, `blobIds` |
| Latest state | `stateId`, `baseStateId`, `through` (last included update), encrypted `payload`, encrypted `summary`, `blobIds` |
| Blob | `sha256` and `byteLength` of the encrypted bytes, uploaded in numbered parts |
| Live message | `spaceOwner` and encrypted `payload` |

Every other value the relay keeps is routing metadata (R9): project ID, document ID, personal
space owner, sending device, sizes, times, update IDs, sequence numbers and blob IDs. Document,
blob, update and state IDs are random strings of 16 to 128 letters, digits, `_` or `-`. Clients
must not derive them from names.

Every request sends `pstdio-sync-protocol: 1` and `Authorization: Bearer <access token>`. A
different version gets HTTP 426 with `error: "protocol-unsupported"`, the supported versions and
a message that tells the person to update (R29). The token's workbench must be the project in
the path. A personal-space path must name the token's account. Blob ID lists hold at most
100,000 IDs.

| Route under `/sync/projects/~<project>[/spaces/~<owner>]` | Method | Result |
| --- | --- | --- |
| `/documents/~<document>/updates` | POST update | `{ sequence, duplicate }` |
| `/documents/~<document>/read` | POST `{ after }` | Latest state metadata and the updates after `after`, or `state-required` |
| `/documents/~<document>/state` | POST latest state | `{ state }`, or 409 `stale-state` with the current state |
| `/documents/~<document>/states/~<state>` | GET | Encrypted latest-state bytes |
| `/blobs/~<blob>/begin` | POST `{ sha256, byteLength }` | Part size and the parts already stored |
| `/blobs/~<blob>/parts/<n>` | PUT bytes with `pstdio-sha256` and `Content-Length` | `{}` |
| `/blobs/~<blob>/finish` | POST `{}` | `{}` once the full blob is verified |
| `/blobs/~<blob>/read` | POST `{ offset }` | Encrypted bytes from `offset` |
| `/live` (project only) | GET WebSocket | `ready`, `live` and `changed` messages |

Errors use the `syncErrorSchema` shapes. `missing-blobs` lists blob IDs that an update or latest
state names before they finished uploading (R21).

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

A blob stays while any stored update or latest state lists it. When the last such row goes, the
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
documents, blobs or live traffic. Phase 1 has one user per account, so a personal space owner
is an account ID. Team accounts (PS-829) add a user claim to access tokens.

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
