# Relay development

The private `pstdio-relay` workspace under `infra/relay/` owns transactional PostgreSQL storage and verified S3 assets for shared extension groups. Its network listener serves liveness only. Authenticated transport, account management, live provider validation, and deployment remain separate work.

## Build and check

Use Bun 1.4.2 and Docker with the Compose plugin. From the repository root:

```sh
bun install --frozen-lockfile
bunx lerna ls --all
bunx lerna run build,typecheck,lint,test --scope pstdio-relay
```

Bun and Lerna discover the relay through the root workspace list. Nx caches its build, type check, lint, and focused tests. The relay depends on `pstdio-sync-contracts` for wire validation and the private `pstdio-sync` package for record and branch rules. It has no dependency on the local API host, UI, desktop client, or synchronization prototype.

## PostgreSQL storage owner

`createRelayStorage(databaseUrl, assets)` creates the internal persistence service. An authenticated caller must derive the scope and published package revision from authoritative grants and catalog state. Calling `initialize(scope, publishedRevision)` creates a scope once; it does not grant access or overwrite an existing publication. `owner(scope)` opens that scope for submission, snapshots, replay, publication revision changes, and restore. Close the service when its owning process stops.

The grouped-record schema has four tables: scoped stream metadata, current records, immutable operation bodies with receipts, and conflict metadata. The owner uses `pg` with Drizzle and stores JSONB objects so indexed resolution captures remain searchable. Each write locks the scope row. Candidate records, conflict revisions, receipt, and replay position commit together. Exact retries return the saved receipt; changed operation bodies cannot reuse an ID. Pending attempts keep their identity and journal order.

`assets.complete(scope, asset)` must verify complete immutable bytes and keep them available through publication and retained history. The PostgreSQL owner checks this port before accepting references. Pass the production `createRelayAssets` service described below to this port.

Snapshots and replay use repeatable-read transactions. Replay contains complete accepted groups. Invalid cursors, gaps, and old epochs require snapshots. Restore checks the scope, sealed receipt bodies, and assets needed by both current records and retained non-pending receipts. It replaces content atomically and creates a new epoch. Historical receipts retain their original acknowledgments; new replay starts at the restored boundary. Grants are outside content restore.

Schema changes start in `infra/relay/src/storage/schema.ts` or `src/assets/schema.ts`. Generate migrations with:

```sh
bun run --cwd infra/relay db:generate
```

Never edit generated SQL by hand. Operators call `migrateRelayStorage(databaseUrl, migrationsFolder)` before opening storage; the runtime image includes the generated `drizzle/` directory. The health listener does not run migrations or claim storage readiness.

Run the focused real PostgreSQL checks and the shared cases with real local stores:

```sh
bun run --cwd infra/relay test:storage
cd packages/pstdio-sync-contracts
SYNC_TEST_ENTRY=../pstdio-db/src/services/extension-storage/grouped-production-relay.integration.ts bun scripts/isolated.ts
```

The storage checks use disposable PostgreSQL and RustFS. They cover independent connections, grouped conflicts, missing assets, scope isolation, historical asset requirements, replay/restore lineage, and killing a publishing process at the commit boundary. The shared cases also cover real local journals, late branches, resolutions, and recovery. Their Docker runner mounts repository source read-only and removes its own stack; it never opens the application's database.

## Durable asset owner

`createRelayAssets({ databaseUrl, bucket, s3 })` owns upload intent, acknowledged multipart parts, and verified asset mappings in three additional PostgreSQL tables. `s3` is an AWS SDK `S3ClientConfig`; supply the endpoint, region, credentials and addressing mode for the selected provider. The service sets `maxAttempts: 1` because a consumed stream cannot be replayed automatically. A caller resumes an immutable upload explicitly after a failed request.

The internal API is:

| Method | Behavior |
| --- | --- |
| `begin(scope, uploadId, asset)` | Bind an upload ID to one exact asset reference and return its part size and durable part receipts. A changed reference is rejected. |
| `writePart(scope, uploadId, number, input)` | Stream one numbered part with its SHA-256, length and optional abort signal. An acknowledged part is not uploaded again. A failed part can resume only with its original descriptor. |
| `finish(scope, uploadId)` | Complete the object, stream its durable bytes through a full SHA-256 and length check, then commit its verified mapping and upload receipt together. |
| `complete(scope, asset)` | Check a verified mapping and the current object length and ETag before group publication. |
| `read(scope, asset)` | Return the declared metadata and a verifying byte stream. The consumer must reach the end before treating the download as verified. |
| `cancel(scope, uploadId)` | Persist cancellation, interrupt the active transfer across owners, drain its writer, and remove only its unfinished object and multipart parts. Repeating cancellation finishes interrupted cleanup. |
| `close()` | Stop admitting work, interrupt active and queued upload operations, drain them, and close this owner's connections. Completed bytes and resumable progress remain durable. |

Upload IDs and asset mappings are scoped by account, workbench and extension. Scope values are not permission: future authenticated callers must derive them from trusted grants. Object keys contain hashes of scope and upload identity. Each upload has its own key, so a retry cannot overwrite another upload's verified bytes. Credentials stay in the service configuration and never enter references, snapshots or extension APIs.

The producer hashes each durable source range before opening its part stream. It need not buffer that range. The service streams with backpressure and checks the part's actual hash and length as well as the provider checksum. Part size follows S3's minimum size, maximum part size and 10,000-part limit; there is no smaller product quota. The final part can be short. Zero-byte assets use an empty object and the same final verification boundary.

Multipart checksums are not the full asset digest. After object completion, `finish` reads the stored object to verify the full reference. Only then can `complete` release a record group. A crash before the metadata commit leaves the object unpublishable; retry verifies the existing object and commits the same intent. A lost multipart-create response is recovered by listing only the upload's exact private key. PostgreSQL advisory locks serialize independent writers without holding one long database transaction through the transfer.

Disconnection retains acknowledged parts and immutable intent. Explicit cancellation retains its cancelled receipt and removes only temporary storage after the writer drains. Completed uploads and their bytes are retained, including duplicate completed uploads, unresolved alternatives and historical receipts. There is no TTL or automatic cleanup. A later manual cleanup design must account for publication, pending work, history and backups before removing completed bytes.

Short metadata operations use a separate PostgreSQL pool so paused streams and queued retries cannot block cancellation. Each owner subscribes to PostgreSQL cancellation notifications before admitting operations. The cancelled row and notification commit together; the payload is a hash of the scoped upload identity. Writers register before reading the durable row. The row remains the authority when a writer starts after a notification. Losing the notification connection interrupts the owner's work and rejects new operations until a new owner starts. Shutdown closes admission before aborting both active transfers and lock waiters.

Cancellation cleanup also carries the owner's abort signal through multipart
listing, abort, part verification and object deletion. Shutdown can interrupt a
paused cleanup response, drain that operation and close its clients. Another owner
can repeat cancellation to finish cleanup from the durable cancelled row.

Run real-store coverage with the existing test allowances:

```sh
bun run --cwd infra/relay test:assets
```

This starts disposable PostgreSQL and RustFS. It checks scoped reads, multipart resume, process kills, lost acknowledgments, corrupt and truncated bytes, denied credentials, cancellation, mixed group publication, restore checks and incremental transfer. Resource observations are diagnostic; this is not the parent's 10,000-record/5 GiB acceptance workload or a performance budget.

## Provider contract

The reusable `src/assets/objects.contract.ts` probe checks the exact S3 operations used by the adapter: multipart creation/listing/recovery, streamed parts, completion, full reads, conditional ETag reads, empty objects, abort, part-list verification and deletion. It creates random keys under `relay-storage-contract/` and deletes only those probe keys and uploads. The local `test:assets` command runs it against RustFS.

Probe cleanup discovers uploads for every owned key, including lost creation responses. It attempts every key and object deletion even if another cleanup step fails, and reports both the original failure and cleanup failures. A permission failure can still leave temporary data; the error identifies the probe key for later authorized cleanup.

For a later authorized Spaces or other provider check, supply an existing disposable bucket through environment variables and run:

```sh
bun run --cwd infra/relay test:objects
```

Required variables are `RELAY_CONTRACT_ENDPOINT`, `RELAY_CONTRACT_BUCKET`, `RELAY_CONTRACT_REGION`, `RELAY_CONTRACT_ACCESS_KEY_ID`, and `RELAY_CONTRACT_SECRET_ACCESS_KEY`. Supply secrets through the environment, not command arguments or committed files. The probe does not create a bucket or change policy. The service needs object read/write/delete, multipart list/abort/part-list access, and bucket listing so missing objects can return 404. Provider access rules must be validated separately.

No live Spaces endpoint, bucket or credentials are configured here. RustFS success does not establish Spaces compatibility. Unsupported provider operations must fail this probe; do not silently replace required behavior.

## Run the isolated smoke check

```sh
bun run --cwd infra/relay test:isolated
```

This command builds the Docker runtime and smoke images, starts PostgreSQL and RustFS, creates a test bucket, and checks:

- The built relay responds to `GET /health` with HTTP 200.
- The built production storage and asset libraries migrate PostgreSQL, withhold a mixed group until streamed bytes are verified, and preserve the receipt and replay after reopening.
- The production S3 adapter streams the completed asset back with matching metadata, digest and length, and retains completed bytes when cancellation is repeated.
- Docker stop sends SIGTERM and the relay exits with code 0.

These checks exercise production persistence and object streaming against RustFS. They do not prove authenticated network synchronization, live provider compatibility, backups, initial download readiness, or the parent's fixed workload and cost gates.

Each run prints a unique `pstdio-relay-test-<uuid>` Compose project name. Its containers, network, and three named data/log volumes belong only to that run. The stack uses fixed test credentials, an internal network, no published host ports, and no host or home-directory mounts. It cannot use the local Prompt Studio database. `infra/local/` remains the separate local application stack.

The runner removes containers, volumes, and the network after success, failure, SIGINT, or SIGTERM. Images and the Docker build cache remain for later runs. If the runner is forcibly killed or the Docker daemon stops, replace the name below with the one printed by that run and clean it up:

```sh
docker compose -p pstdio-relay-test-<uuid> -f infra/relay/compose.test.yaml down --volumes --remove-orphans
```

Do not prune other projects' Docker resources to repair a failed run. Check Docker's error and the printed project name first.

## Portable runtime image

Build from the repository root:

```sh
docker build -f infra/relay/Dockerfile -t pstdio-relay:local .
docker run --rm -p 127.0.0.1:8080:8080 pstdio-relay:local
```

The final image contains Bun, the built listener and storage library, and generated migrations. It needs no developer checkout, dependency install, mounted files, or cloud credentials to serve liveness. Storage callers supply their own connection and object port. It runs as the unprivileged `bun` user.

`RELAY_HOST` and `RELAY_PORT` select the listener. Source execution defaults to `127.0.0.1:8080`; the image defaults to `0.0.0.0:8080`. The port must be an integer from 0 to 65535; 0 asks the operating system to choose a free port. SIGINT and SIGTERM stop accepting connections and let active requests finish. `/health` is liveness only, not a storage-readiness or authentication endpoint. Other routes return 404.

The isolated smoke image reads `RELAY_URL`, `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` from the test Compose file. These configure the production libraries inside the disposable smoke; they are not listener routes or production defaults. RustFS is a local S3-compatible fixture. See [AWS multipart ownership](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), [multipart limits](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html), [checksum semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), and the [RustFS container documentation](https://docs.rustfs.com/en/installation/container/docker).

## Infrastructure boundary

Future Terraform configuration belongs under `infra/relay/terraform/`, separate from `src/`. This scaffold defines no resources, backend, remote state, provider credentials, or deployment workflow. Terraform state, local variable files, and working data are ignored by Git; the Terraform directory and relay environment files are excluded from Docker build contexts. Never commit application secrets or generated runtime data.

CI runs the relay's ordinary package checks through Lerna and an isolated Docker smoke job when the relay or shared tooling changes. See [package boundaries](../../references/architecture/0013-package-boundaries.md) for dependency rules. The relay stays private and is excluded from Changesets publication. Shared model changes also require the packaged CLI checks because local storage and the SDK test adapter bundle that model.
