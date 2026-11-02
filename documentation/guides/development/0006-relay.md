# Relay development

The private `pstdio-relay` workspace under `services/relay/` serves the blind sync
protocol from [PRD 0014](../../requirements/platform/0014-local-first-sync.md).
It stores encrypted updates, latest states and blobs under `/sync/`, and forwards
transient live messages. It cannot read their contents. The
[blind relay reference](../../references/architecture/0029-blind-relay.md) describes
routing, cleanup and limits. The old grouped-record relay and its recovery proofs
have been removed.

## Owners and storage

`createSyncOwners` in `src/transport/owners.ts` builds the document store, live hub
and rate limit. The runtime reads operator limits with `readRelayLimits(env)` and
runs cleanup every hour. `createRelaySync` owns encrypted documents and blobs;
`createRelayAssets` supplies verified multipart object storage. Close these owners
when their process stops.

PostgreSQL holds routing metadata, update sequence numbers and latest-state
compare-and-swap boundaries. Object storage holds encrypted payloads. Schema changes
start in `src/storage/document-schema.ts` or `src/assets/schema.ts`:

```sh
bun run --cwd services/relay db:generate
```

Never edit generated SQL by hand. Operators run
`migrateRelayStorage(databaseUrl, migrationsFolder)` before opening storage. The
runtime includes generated migrations but does not run them during startup.
Migration 0004 drops the four replaced grouped-record tables. It preserves the
blind document, latest-state, update, blob and multipart tables.

Blob uploads bind an identity to a digest and byte length. Parts stream with
backpressure and exact hash/length checks. Completion verifies the full stored
object before a document update can refer to it. Lost replies reuse immutable
upload intent and acknowledged parts. Range reads verify the provider ETag and
remaining length; clients verify the complete assembled ciphertext. Cleanup follows
the blind protocol's grace period and live blob references.

## Authentication and live delivery

The manager registers one credential per device. The native host exchanges it for
finite project access tokens through `/v1/environment-access`. The relay verifies
those tokens locally against public Ed25519 trust. Device removal denies renewal;
issued tokens keep their original finite expiry. The relay has no manager database,
signing secret or device credential.

The live channel uses its independently versioned protocol. Clients subscribe to document
IDs for metadata-only change hints and subscribe to transient encrypted topics.
Durable catch-up remains authoritative. A reconnect reads missing updates; presence
and live messages never become stored content. See the
[two-dashboard guide](0008-two-dashboard-relay.md) for an isolated application check.

## Build and validation

Use Bun 1.4.4 and Docker with the Compose plugin:

```sh
bun install --frozen-lockfile
bun run --cwd services/relay lint
bun run --cwd services/relay build
bun run --cwd services/relay test
bun run --cwd services/relay test:integration
```

The integration command first builds and runs the actual Docker runtime and smoke
images. It then runs real PostgreSQL/RustFS tests in disposable databases. Checks
cover duplicate updates, stale latest-state rejection, verified blob dependencies,
grace-period retention, account isolation, encrypted storage dumps, live routing,
rate limits, telemetry redaction, finite access and restart persistence.

The built client receives only a relay URL and issued access token. It uploads and
reads blobs, retries updates, receives change hints and verifies denial after token
expiry. A separate operator removes its device and proves renewal denial. The
shutdown smoke retains its 12-reader/10-backend workload and requires the server to
exit before an external table lock is released.

The full 10,000-update storage check remains a manual benchmark:
`bun run --cwd services/relay bench:storage-bound`. See
[relay storage bound](../../references/performance/0003-relay-storage-bound.md).

The isolated runner waits for object storage readiness and bypasses the configured
client proxy only for its local service names and loopback addresses. It mounts
source read-only and never opens the application's database. Each run prints its
unique Compose project name and removes only its own containers and volumes.

## Runtime image and deployment

```sh
docker build -f infra/relay/Dockerfile -t pstdio-relay:local .
```

The final image contains Bun, built service/storage libraries and migrations. It
runs as the unprivileged bun user, with no source checkout or runtime installation.
Fixture authority code and private keys exist only in separate smoke stages.

Operators supply `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and public signing trust through
`RELAY_ACCESS_TRUST` or `RELAY_ACCESS_TRUST_FILE`. Trust contains the manager issuer,
relay audience and public JWKS. Distribute new public keys before issuing tokens
with them and retain old public keys through token expiry.

`RELAY_HOST` and `RELAY_PORT` select the listener. Source defaults to
127.0.0.1:8080; the image defaults to 0.0.0.0:8080. `GET /health` reports liveness.
SIGINT/SIGTERM stop admission and drain owned work. Cancellable database leases use
a separate control connection so saturated pools and external locks cannot retain
owned queries after shutdown.

Deployment files live under `infra/`. See the
[portable deployment guide](0012-portable-cloud-deployment.md) and
`infra/terraform/` for the infrastructure boundary. CI builds service images and
runs isolated checks; local storage and SDK consumers also need packaged checks
when shared model code changes.

## Provider contract

The reusable `src/assets/objects.contract.ts` probe checks the exact S3 operations used by the adapter: multipart creation/listing/recovery, streamed parts, completion, full reads, conditional ETag reads, immutable byte ranges, empty objects, abort, part-list verification and deletion. It creates random keys under `relay-storage-contract/` and deletes only those probe keys and uploads. The local `test:integration` command runs it against RustFS.

Probe cleanup discovers uploads for every owned key, including lost creation responses. It attempts every key and object deletion even if another cleanup step fails, and reports both the original failure and cleanup failures. A permission failure can still leave temporary data; the error identifies the probe key for later authorized cleanup.

For a later authorized Spaces or other provider check, supply an existing disposable bucket through environment variables and run:

```sh
bun test --cwd services/relay src/assets/objects.contract.p1.integration.ts
```

Required variables are `RELAY_CONTRACT_ENDPOINT`, `RELAY_CONTRACT_BUCKET`, `RELAY_CONTRACT_REGION`, `RELAY_CONTRACT_ACCESS_KEY_ID`, and `RELAY_CONTRACT_SECRET_ACCESS_KEY`. Supply secrets through the environment, not command arguments or committed files. The probe does not create a bucket or change policy. The service needs object read/write/delete, multipart list/abort/part-list access, and bucket listing so missing objects can return 404. Provider access rules must be validated separately.

No live Spaces endpoint, bucket or credentials are configured here. RustFS success does not establish Spaces compatibility. Unsupported provider operations must fail this probe; do not silently replace required behavior.
