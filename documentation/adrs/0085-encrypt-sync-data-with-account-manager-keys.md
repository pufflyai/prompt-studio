# Encrypt sync data with keys from the account manager

Proposed: 2026-10-20

Status: Accepted

## Context

[PRD 0014](../requirements/platform/0014-local-first-sync.md) moves merging to the clients. The
[blind relay](../references/architecture/0029-blind-relay.md) stores only ciphertext and routing
metadata (R8 to R10). Clients need keys that:

- every device of the user gets after Google login, without a step per project (R12, R34)
- are split into a project key and a key for the user's private project data from the start (R13)
- survive the loss of the key store (R14)
- change for future data when a device leaves, while older data stays readable (R15)

Document IDs must reveal no names (R9). Two devices that never talked to each other must still
find the same relay document for, say, the Planner records of a project.

## Decision

### Keys live in the account manager

The account manager keeps keys in `manager_space_keys`, in its own database, apart from the
relay. One row is one generation of one space: the account, the workbench, `project` or
`personal`, the generation number and 32 random bytes.

- The first key request for a cloud project creates generation 1 of both keys. Keys are created in
  this one place, whenever the project became a cloud project.
- Removing a device, including the removal of every device during operator reconciliation, adds
  the next generation of every key of the account.
- `GET /v1/workbenches/:id/keys` with a device credential returns every generation of both keys,
  oldest first. The response shape is `spaceKeysSchema` in `pstdio-sync-contracts`.
- Removing a cloud project keeps its keys, so a project that syncs again still reads its relay data.
- The sync transport must fetch the keys again every time it renews relay access. A rotation reaches
  every remaining device within one access lifetime. That is also how long the removed device's
  issued access keeps working, so the removed device gains no extra window.
- Manager snapshots (version 3) include every key, and restore puts them back. A restore that would
  change a stored key fails.

Phase 1 has one user per account, so the personal key belongs to the account. Team accounts
(phase 3) will add the member to the personal key row. The format of sealed data does not change.

### Clients seal at the transport boundary

`packages/pstdio-sync/src/encryption/` turns keys into a sync space and seals every relay payload.

- HKDF-SHA-256 derives an AES-GCM-256 key from each generation's secret.
- Sealed bytes are: format version (1 byte), key generation (4 bytes), a random 12-byte nonce, then
  the ciphertext and tag. New data uses the newest generation. Opening picks the generation from
  the header.
- The authenticated context names the project, the space owner, the kind of data (update, latest
  state, summary, blob or live message) and its document, update, state, blob or sending device ID.
  For a latest state it also names the base state and the last included update, which the relay
  reads in the clear. The relay cannot move sealed bytes to another place or change that metadata
  without the open failing.
- Data that cannot be opened raises `UnreadableSyncData`, so the transport can report it and set
  it aside (R30).

### Document IDs are a keyed hash of the name

A document ID is the first 16 bytes of HMAC-SHA-256 of the local document name, keyed with a key
derived from the space's first generation. Every device of the space derives the same ID, a rotation
never moves a document, and without the key the ID says nothing about the name. Blob, update and
state IDs are 16 random bytes.

We rejected random document IDs with a directory document. The directory would need a fixed ID of
its own, and two devices that create the same document offline would create two documents.

## Consequences

- Known limit, accepted in R12: whoever controls both the account manager and the relay can read
  data. The manager stores secrets in plain form in its database. A stronger design, for example
  with passkeys, may replace this later.
- A removed device keeps the keys it already had. It can read data written before its removal,
  not after (R15, R37).
- A rotation that happens after the last manager snapshot is lost if the key store is lost.
  Devices then still hold the newer data and can upload it again (R3). The header names only the
  generation number, so the next rotation reuses the lost number with a new secret, and data
  sealed with the lost key stays unreadable. Operators should take a snapshot after rotations.
- Logging in again with Google undoes a device removal, and the device then gets every generation.
  Google login is the trust root of this design.
- The naming key never rotates. A removed device that also controls the relay can confirm which
  known document names exist, but it cannot read their content.
- The key generation in the sealed header is visible to the relay. It shows how often a space's
  keys changed, nothing more.
- Random 96-bit nonces limit one key generation to about 2³² sealed messages. Rotations and the
  expected volume keep this far away.
- Manager snapshots taken before this change (version 2) cannot be restored. No deployed manager
  has users yet.
