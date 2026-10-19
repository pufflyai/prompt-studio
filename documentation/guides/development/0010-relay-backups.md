# Relay backups

The relay backup service takes hourly content captures and copies their required bytes into a separate private bucket. It runs independently of the request-serving relay and the account manager.

## Run the scheduler

Build the relay image as described in [relay development](0006-relay.md). The same image includes `/app/backup-server.js`. An operator can run it as a separate long-lived process with `bun /app/backup-server.js`. Starting that process is an operational action; the build and tests do not deploy or activate it.

Supply configuration through the service environment or a secret store:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Relay content PostgreSQL database, never the account manager database |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` | Existing live relay object store |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Live store read credentials |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION` | Existing separate private backup store |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | Backup worker credentials |
| `RELAY_BACKUP_HOST` | Status listener address; default `127.0.0.1` |
| `RELAY_BACKUP_PORT` | Status listener port; default `8081` |

The service creates no buckets, policies, cloud resources, migrations or account-manager backups. Run the normal relay migrations before starting it. The same endpoint and bucket cannot be used for both stores. Both S3 clients use path-style addressing. Keep backup credentials out of the normal relay and extensions. Do not supply manager signing keys, login data, or recovery authority credentials to the backup process.

On start, the scheduler checks durable `status.json`. With no attempt it captures immediately. A completed or failed attempt establishes the next deadline one hour after its start. Restarting before that deadline does not create another snapshot. An interrupted attempt retries immediately when a replacement obtains the database lease. A busy lease or an unavailable service is checked again after one minute. These checks do not move the hourly deadline. Jobs do not overlap.

An hour is the recovery-point target. A failed job, unavailable store, slow copy, or stopped scheduler can miss it. The catalog reports a backup stale when its captured boundary is at least an hour old; starting a job does not refresh that boundary. Monitor this state and investigate missed deadlines. There is no promise that an arbitrary storage outage can meet the target.

`SIGINT` and `SIGTERM` stop admission, cancel database and object requests, drain work and close connections. A killed process leaves its durable capture pins until a replacement obtains the lease. No expiry timer releases those pins.

## Permissions and privacy

Provision and verify a private bucket before activation. Disable public access and anonymous listing/reads; apply the provider's private access rules. Use separate credentials and access policies for live objects, backup writing, backup reading and administration. The worker does not send public ACLs or publish download URLs. The local smoke test verifies anonymous access is denied; it does not validate a production provider's policy.

The worker needs read access to relay content and coverage tables and permission to lock the content publication boundary and insert/delete backup-owned rows in `relay_captures`. It needs live object HEAD/GET access. Its backup role needs bucket listing, object HEAD/GET/PUT, multipart create/upload/complete/list/abort, and conditional writes. It needs no deletion permission for completed backup objects. Administrators own bucket configuration, encryption, durability, versioning and retention policy. Test those policies with the intended roles before activation.

Immutable objects require conditional creation (`If-None-Match: *`) for both empty and multipart completion. `status.json` requires conditional replacement (`If-Match` with its last ETag). Unsupported conditional operations fail the job. Do not silently replace them with unconditional writes. The existing [provider probe](0006-relay.md#provider-contract) checks the live asset operations; a separate provider acceptance effort must verify these backup operations against an authorized disposable provider bucket. This assignment tests PostgreSQL and RustFS only.

The database capture contains synchronized extension records, map/text state, document generations, writer floors, conflict branches, receipts and coverage evidence. It excludes grants, recovery authorization proofs, manager tables, runtime credentials, sessions, processes, local working directories and unpublished source overrides. Extension content can itself be private: protect the whole bucket and its status listener. Keep the listener on a private interface or behind existing operator access controls.

## Capture, manifests and coverage

The [backup worker](../../../infra/relay/src/backup/worker.ts) obtains a PostgreSQL session advisory lock. In one content transaction it locks `relay_scopes`, reads all existing scopes and their native protocol 2 snapshots, and saves each required reference in `relay_captures`. Publication, restore, initialization and deletion use the same boundary. The database transaction ends before copying bytes. New content can publish while the copied boundary remains protected.

Backup capture IDs start with `backup:<attempt-id>:`. While the lease is held, replacement cleanup removes only this prefix. Other capture owners keep their pins. Success and handled failure release the current job's pins after copying stops. Connection loss fences that owner and leaves its pins for replacement cleanup. PS-781 must treat every capture's references as live roots under its deletion boundary; a complete independent backup does not keep obsolete live versions pinned forever.

The private bucket is the durable backup authority. It contains:

| Key | Contents |
| --- | --- |
| `objects/<asset-fingerprint>` | Independent immutable bytes, keyed by SHA-256 plus length and media-type identity |
| `manifests/<sha256>` | A strict scope manifest with the complete native content snapshot, exact canonical snapshot checksum, scoped byte/package references and environment coverage evidence |
| `complete/<attempt-id>/<sha256>` | A strict root manifest naming the exact checksummed scope manifests and capture time |
| `status.json` | Conditional scheduler state, failure information and the last independently verified complete root handle |

The schemas live in [backups.ts](../../../packages/pstdio-sync-contracts/src/backups.ts). Snapshot coverage preserves the real restore epoch, stream generation, accepted cut, covered cut, enrolled writer floors, document generations, retained branches, publication revision and pending/conflicting receipt tail. It does not invent document facts for generic records. The recovery byte closure includes current and retained branches plus every asset base/next in the uncovered tail. A publication capture includes the catalog's exact package asset.

Assets stream through bounded multipart buffers, with backpressure, length checks and full SHA-256 checks. The service never stages a whole backup on application disk. Database snapshot and JSON manifest metadata are held in memory per capture; this is not a constant-memory SQL dump. Unchanged complete objects are read and verified in the backup bucket and reused without another live read or write. Backup-owned unfinished multipart uploads are removed after replacement obtains the lease. Completed copies and older manifests are retained.

A root is written only after all its assets and scope manifests verify. Before updating `status.json`, the worker reopens the root, checks all manifest hashes and scope/publication identities, validates sealed receipt bodies and independently reads every referenced backup object. Conditional status replacement fences a delayed owner. A root written just before a failure can remain an orphan candidate; it supplies no retention coverage unless the status pointer was committed successfully.

`createRelayBackupCatalog(backupConfig).readCoverage(now, signal?)` is the PS-781 port. It reads the durable status and re-verifies the selected root through backup-only reads. Only `state: "verified"` returns `backupCoverageSchema` entries: exact scope, epoch, generation, accepted cut, native snapshot checksum and complete-root checksum. Never-completed, running, failed, stale and corrupt backups return no coverage. Coverage is not inferred from a job log, row count, a listed key, a Done ticket or a successful capture alone. A new restore epoch cannot reuse an old backup's coverage.

`catalog.list()` discovers retained root candidates. Call `catalog.open(handle)` to verify each candidate before use; listing alone is not restore approval. `open` returns the manifests and a checked streaming `read(asset)` function. Close catalog and worker resources when finished. These are internal operator/storage interfaces, not an on-demand backup product action.

## Status and failure recovery

`GET /health` returns the attempt state, capture time and failure reason. It returns 200 only for a completed fresh job, otherwise 503. This is a passive scheduler status check; use `readCoverage` for independently verified retention authorization. The listener serves no backup trigger or restore route. Structured `relay.backup.status` and `relay.backup.failed` logs support operator alerts. Do not expose error output publicly.

A pending receipt can reference an asset that its producer has not completed yet. The backup fails closed until every required recovery byte is durable and readable. It preserves the receipt and reports missing source bytes; it does not invent an empty file or certify a partial closure.

If a job fails, inspect the reported database, permission, source-byte, checksum or storage error and repair that cause. The scheduler retries at the next deadline. Restarting an interrupted worker lets its successor clean abandoned backup pins and multipart uploads and retry. Do not delete `status.json` or release pins manually to hide a failed backup. Restore missing/corrupt copies from a trusted source through an authorized recovery procedure; the worker refuses to overwrite a conflicting immutable copy.

Completed backups deliberately retain storage independently of the live bucket. Account for retained data, manifests, reused copies and any uploads abandoned while no replacement runs in PS-787 cost evidence. This feature has no automatic backup expiry or completed-object deletion. A later retention policy must preserve every retained root's complete closure before deleting any shared copy.

## Restore validation

Use a read-only backup role and `catalog.open(handle)` to verify a chosen retained root before changing a destination. Stream each scoped reference into the destination's ordinary verified asset owner, preserving its checksum, length and media type. Restore the publication catalog before dependent extension scopes through the existing content restore owner. It assigns a fresh epoch; old environment acknowledgements and backup coverage do not authorize the new lineage. Do not restore grants or manager authority from content manifests. PS-782 owns production restore orchestration and returning-local reconciliation.

Run the focused real-store acceptance checks:

```sh
bun run --cwd infra/relay test:backups
bun run --cwd infra/relay test:isolated
```

The first command creates disposable PostgreSQL and RustFS stores. It verifies hourly scheduling across worker replacement, unchanged-copy reuse, exact coverage, private access, pending/conflict assets, concurrent publication, database interruption, process kill during streaming, abandoned-pin/multipart cleanup, stale status fencing and conditional immutable writes. It restores an older retained backup after deleting all live test objects and content rows, including package bytes, scalar/map state and a fresh restore epoch. This proves independence after live data loss; PS-781 separately owns its actual compactor/deletion integration tests. The second command builds the image and checks the bundled worker, scheduler and clean shutdown without manager credentials. Both remove their test stacks and volumes.

No production bucket, deployment or activation is performed by these commands. They do not replace the fixed PS-735 workload, cross-platform restore checks or live provider acceptance.
