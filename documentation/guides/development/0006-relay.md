# Relay development

The private `pstdio-relay` workspace under `services/relay/` owns transactional PostgreSQL storage and verified S3 assets for shared extension groups. It serves authenticated HTTP and finite native WebSocket subscriptions. The native runtime adapter and two-dashboard launcher are described in [the local relay guide](0008-two-dashboard-relay.md). Public browser onboarding, live provider validation and deployment remain separate work.

## Blind sync store

The relay also serves the blind sync protocol from [PRD 0014](../../requirements/platform/0014-local-first-sync.md) under `/sync/`. It stores encrypted updates, latest states and blobs per document and cannot read them. The [blind relay reference](../../references/architecture/0029-blind-relay.md) describes the protocol, cleanup and limits. The grouped storage described below keeps working until clients move to the new protocol; PS-824 removes it.

`createSyncOwners` in `src/transport/owners.ts` builds the document store, the live connection hub and the rate limit. The runtime reads operator limits with `readRelayLimits(env)` and runs cleanup every hour. Schema changes start in `src/storage/document-schema.ts` and use the same `db:generate` command.

Run the real PostgreSQL and object storage checks:

```sh
bun run --cwd services/relay test:sync
```

They cover duplicate updates, rejected stale latest states, blobs kept for the grace period, a storage dump with no plaintext from a seeded project, the storage bound across ten compaction cycles, protocol version errors, access to private project data, live forwarding and rate limits.

The full 10,000-update storage check is a manual benchmark: `bun run --cwd services/relay bench:storage-bound`. See [relay storage bound](../../references/performance/0003-relay-storage-bound.md).

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

Schema changes start in `services/relay/src/storage/schema.ts` or `src/assets/schema.ts`. Generate migrations with:

```sh
bun run --cwd services/relay db:generate
```

Never edit generated SQL by hand. Operators call `migrateRelayStorage(databaseUrl, migrationsFolder)` before opening storage; the runtime image includes the generated `drizzle/` directory. The service does not run migrations or claim storage readiness through liveness.

Run the focused real PostgreSQL checks:

```sh
bun run --cwd services/relay test:storage
```

The storage checks use disposable PostgreSQL and RustFS. They cover independent connections, grouped conflicts, missing assets, scope isolation, historical asset requirements, replay/restore lineage, and killing a publishing process at the commit boundary. The Docker runner mounts repository source read-only and removes its own stack; it never opens the application's database.

`bun run --cwd packages/pstdio-sync-contracts test:conformance` runs the reference relay suite (`src/conformance/reference.integration.ts`). `SYNC_TEST_ENTRY` selects a different test file for the runner. Since 0.46 the app has no grouped local storage, so there are no local-store conformance entries in `pstdio-db`.

The runner waits for `http://objects:9000/health` before it starts the tests. It prints `Test object storage ready at http://objects:9000` when the check passes. When it fails, the error names the endpoint and the last HTTP status or connection error. Docker passes a proxy from Docker Desktop or `~/.docker/config.json` into every container. The runner sets `NO_PROXY` for its services and for loopback addresses, so requests between containers and to the tests' own servers stay on the run's network. An HTTP 403 such as `No approved upstream IPv4 address` in that error means a request went to the proxy instead; check that the runner's `NO_PROXY` still lists the host. The relay fixtures in `compose.test.yaml` set the same list. Do not turn off the proxy or other network controls to get past it.

## Durable asset owner

`createRelayAssets({ databaseUrl, bucket, s3 })` owns upload intent, acknowledged multipart parts, and verified asset mappings in three additional PostgreSQL tables. `s3` is an AWS SDK `S3ClientConfig`; supply the endpoint, region, credentials and addressing mode for the selected provider. The service sets `maxAttempts: 1` because a consumed stream cannot be replayed automatically. A caller resumes an immutable upload explicitly after a failed request.

The internal API is:

| Method | Behavior |
| --- | --- |
| `begin(scope, uploadId, asset)` | Bind an upload ID to one exact asset reference and return its part size and durable part receipts. A changed reference is rejected. |
| `writePart(scope, uploadId, number, input)` | Stream one numbered part with its SHA-256, length and optional abort signal. An acknowledged part is not uploaded again. A failed part can resume only with its original descriptor. |
| `finish(scope, uploadId)` | Complete the object, stream its durable bytes through a full SHA-256 and length check, then commit its verified mapping and upload receipt together. |
| `complete(scope, asset)` | Check a verified mapping and the current object length and ETag before group publication. |
| `read(scope, asset, offset = 0, signal?)` | Stream the full object with digest verification, or request an immutable S3 suffix with exact ETag/range/remaining-length checks. An offset at the end returns an empty stream. The receiver verifies the complete assembled asset. |
| `cancel(scope, uploadId)` | Persist cancellation, interrupt the active transfer across owners, drain its writer, and remove only its unfinished object and multipart parts. Repeating cancellation finishes interrupted cleanup. |
| `close()` | Stop admitting work, interrupt active and queued upload operations, drain them, and close this owner's connections. Completed bytes and resumable progress remain durable. |

Upload IDs and asset mappings are scoped by account, workbench and extension. The network service derives account and environment identity from locally verified finite access claims before each operation. Object keys contain hashes of scope and upload identity. Each upload has its own key, so a retry cannot overwrite another upload's verified bytes. Credentials stay in the service configuration and never enter references, snapshots or extension APIs.

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
bun run --cwd services/relay test:assets
```

This starts disposable PostgreSQL and RustFS. It checks scoped reads, multipart resume, process kills, lost acknowledgments, corrupt and truncated bytes, denied credentials, cancellation, mixed group publication, restore checks and incremental transfer. Resource observations are diagnostic; this is not the parent's 10,000-record/5 GiB acceptance workload or a performance budget.

## Provider contract

The reusable `src/assets/objects.contract.ts` probe checks the exact S3 operations used by the adapter: multipart creation/listing/recovery, streamed parts, completion, full reads, conditional ETag reads, immutable byte ranges, empty objects, abort, part-list verification and deletion. It creates random keys under `relay-storage-contract/` and deletes only those probe keys and uploads. The local `test:assets` command runs it against RustFS.

Probe cleanup discovers uploads for every owned key, including lost creation responses. It attempts every key and object deletion even if another cleanup step fails, and reports both the original failure and cleanup failures. A permission failure can still leave temporary data; the error identifies the probe key for later authorized cleanup.

For a later authorized Spaces or other provider check, supply an existing disposable bucket through environment variables and run:

```sh
bun run --cwd services/relay test:objects
```

Required variables are `RELAY_CONTRACT_ENDPOINT`, `RELAY_CONTRACT_BUCKET`, `RELAY_CONTRACT_REGION`, `RELAY_CONTRACT_ACCESS_KEY_ID`, and `RELAY_CONTRACT_SECRET_ACCESS_KEY`. Supply secrets through the environment, not command arguments or committed files. The probe does not create a bucket or change policy. The service needs object read/write/delete, multipart list/abort/part-list access, and bucket listing so missing objects can return 404. Provider access rules must be validated separately.

No live Spaces endpoint, bucket or credentials are configured here. RustFS success does not establish Spaces compatibility. Unsupported provider operations must fail this probe; do not silently replace required behavior.


## Authenticated HTTP and subscriptions

Use `relayPath({ workbenchId, extensionId }, operation)` from `pstdio-sync-contracts`. Paths are `/v1/workbenches/~<encoded-id>/extensions/~<encoded-id>/<operation>`. The prefix keeps opaque dot identities from becoming traversal segments. Account identity and credentials never enter URLs. Native clients send `Authorization: Bearer <environment-token>`. The scheme is case-insensitive; credential bytes stay exact. URL queries are rejected.

Every protected operation verifies a signed environment access token locally against trusted manager public keys, issuer and relay audience. The verified account/workbench/environment scopes the existing data owners. A submitted mutation must already contain exactly that scope and environment; the relay rejects mismatches without rewriting its fingerprint. An authenticated `initialize` request creates the selected extension scope once using the installed package revision. The token must authorize its account and workbench. Retrying initialization leaves an existing published revision unchanged. No restore, administrative issuance, Google login or arbitrary revision setter is exposed.

| Operation | Method and input | Result |
| --- | --- | --- |
| `snapshot` | GET | Existing strict snapshot |
| `submit` | POST existing sealed mutation | Durable receipt, including pending/conflict outcomes |
| `recover` | POST `{ mutation, proof }` for an exact previously stored operation | Normal publication outcome after current authorization and relay proof verification; the original environment and operation ID stay unchanged |
| `replay` | POST checkpoint | Strict replay result or snapshot-required boundary |
| `assets/begin` | POST `{ uploadId, asset }` | Asset, part size, completion and acknowledged part number/hash/length; no object key or provider receipt |
| `assets/part` | PUT byte stream | Empty JSON acknowledgment |
| `assets/finish` | POST `{ uploadId }` | Fully verified asset |
| `assets/cancel` | POST `{ uploadId }` | Empty JSON acknowledgment after cancellation drains |
| `assets/read` | POST `{ asset, offset }` | HTTP 200 with streamed bytes and explicit x-pstdio-offset / x-pstdio-byte-length metadata |
| `changes` | GET with native WebSocket upgrade | Strict `{ protocolVersion: 1, type: "ready" | "changed" }` hints |

A part supplies `x-pstdio-upload-id` (encodeURIComponent of its ID), `x-pstdio-part-number`, `x-pstdio-sha256` and exact `Content-Length`. Its body streams to the existing multipart owner with request cancellation. The listener accepts the existing S3 maximum part size; it does not buffer that body. Begin returns only acknowledged parts, so a dropped part retries the same immutable descriptor. Explicit cancellation removes unfinished bytes after the writer drains. Cleanup of an existing scoped upload uses the asset owner directly after current authorization; it does not repeat a content checkpoint that could block cancellation behind unrelated content reads.

Suffix reads issue a real S3 Range with If-Match. The adapter validates returned status, ETag, media type, Content-Range and remaining length, then checks the streamed suffix length. The POST response uses 200 and explicit x-pstdio-offset / x-pstdio-byte-length metadata, with chunked framing when needed. It does not advertise GET Range semantics; see [HTTP range handling](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2). No large prefix is downloaded merely to skip it. A suffix cannot prove the full SHA-256: the receiving local store must verify the complete assembled file before publication. Full reads retain full digest checks.

The native client in `packages/pstdio-sync/src/relay/http.ts` uses `initialize`, `submit`, `recover`, `snapshot`, the asset operations, and `changes`. It resynchronizes from a full snapshot and does not call `replay`. Only the relay tests exercise `replay`.

A dedicated PostgreSQL connection commits LISTEN before the initial scope read and socket readiness. Data-owner transactions emit only the scope fingerprint when receipts, conflicts, publication revision or restore change. Notifications arrive after commit and carry no content. They are hints; durable snapshots/replay remain truth. Subscribe before initial synchronization and resynchronize after reconnect. See [NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html) and the [LISTEN setup race](https://www.postgresql.org/docs/16/sql-listen.html).

An unchanged pending retry checks its dependencies again but produces no new hint. Pending operations can advance when their dependencies or assets become available without creating a request loop while they remain blocked.

Network receipts include `recoveryProof` for their exact immutable operation, including pending and conflicting ancestors. Snapshots and replay include the same evidence after a lost response. Journals retain it independently of the current accepted snapshot. The `recover` route accepts a foreign environment's original operation only with this evidence and current account/workbench authority, then repeats normal validation and publication. An ordinary `submit` still requires the authenticated author environment. See [ADR 0080](../../adrs/0080-authenticate-relay-operation-recovery.md).

Subscriptions retain the verified access expiry and close with1008 at that deadline, including while content reads are locked. Ready and changed hints check the same deadline. Revocation, replacement and account disable deny future manager renewal; issued tokens remain usable until expiry. Manager outages do not interrupt unexpired access. There are no per-request, hint or idle manager calls. Hints coalesce through one dirty bit and a scheduled delivery; a slow consumer closes1013. Listener loss closes1011 and requires a fresh listener owner plus resynchronization. Already authorized HTTP operations may finish.

Responses use no-store and sanitized errors. Missing/invalid credentials return 401 with a generic Bearer challenge; identity mismatch returns 403, malformed input 400, method mismatch 405 with Allow, unavailable subscription 503, and rejected content operations 409. Missing assets return 404. Unsupported routes return 404.

Run `bun run --cwd services/relay test:transport` for real HTTP, native WebSockets, separate authority/content roles, overlapping account identities, multipart disconnect/resume/cancel, committed hints, idle expiry under content locks, manager outage, restore and failure coverage. It uses the existing conformance runner's disposable PostgreSQL/RustFS stack on default subnet 10.254.236.0/24. Run these fixtures sequentially. It adds no test allowance or reduced workload.

## Run the isolated smoke check

```sh
bun run --cwd services/relay test:isolated
```

This command builds the Docker runtime and smoke images, starts PostgreSQL and RustFS, creates a test bucket, and checks:

- The built relay responds to `GET /health` with HTTP 200.
- The built production storage and asset libraries migrate PostgreSQL, withhold a mixed group until streamed bytes are verified, and preserve the receipt and replay after reopening.
- The production S3 adapter streams the completed asset back with matching metadata, digest and length, and retains completed bytes when cancellation is repeated.
- Docker stop sends SIGTERM and the relay exits with code 0.

The same run initializes separate manager and relay roles and serves the actual bundled Better Auth manager over owned fixture HTTPS. Its initializer writes public signing trust to a separate read-only relay volume. A separately bundled client receives only the relay URL, scope and issued access token. It exercises HTTP uploads, verified offset reads, grouped submit/retry/replay, metadata-only WebSocket hints, idle access expiry and subsequent request denial. An operator process removes the device and proves renewal denial. The original storage workload and12-reader/10-backend shutdown workload remain intact. No source mount or runtime install is used. These checks do not prove live provider compatibility, public onboarding, the complete local replication adapter, backups, or the parent's fixed workload and cost gates.

Each run prints a unique `pstdio-relay-test-<uuid>` Compose project name. Its containers, network, and owned data/log and fixture volumes belong only to that run. The stack uses fixed test credentials, an internal network, no published host ports, and no host or home-directory mounts. It cannot use the local Prompt Studio database. `infra/local/` remains the separate local application stack.

The runner removes containers, volumes, and the network after success, failure, SIGINT, or SIGTERM. Its `down` includes the `test` profile, so the volumes that only test services use are removed too. Images and the Docker build cache remain for later runs. If the runner is forcibly killed or the Docker daemon stops, replace the name below with the one printed by that run and clean it up:

```sh
docker compose -p pstdio-relay-test-<uuid> -f infra/relay/compose.test.yaml down --volumes --remove-orphans
```

Do not prune other projects' Docker resources to repair a failed run. Check Docker's error and the printed project name first.

## Portable runtime image

Build from the repository root:

```sh
docker build -f infra/relay/Dockerfile -t pstdio-relay:local .
```

The final runtime target contains Bun, the built service/storage library and generated relay migrations. It runs as the unprivileged bun user, without a source checkout or runtime install. Operator tooling must apply migrations before use. A logged-in native host initializes enabled extension scopes through the authenticated transport. The default build remains this production target; test-only authority code, private keys and fixture initialization exist only in separate smoke stages.

Trusted deployment settings supply `DATABASE_URL` for the relay role; `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; and `RELAY_ACCESS_TRUST_FILE`, a JSON file with manager `issuer`, relay `audience` and public Ed25519 `jwks`. Keys come from the manager's `/api/auth/jwks` endpoint through an operator-controlled update. Key rotation must distribute new public keys before issuing access with them and retain old public keys through their tokens' expiry. Relay receives no manager database, signing secret, device credential or private service credential. Configuration errors discard sensitive original errors and causes.

`RELAY_RECOVERY_KEY_FILE` supplies a separate immutable 32-byte recovery key shared by relay replicas. Preserve and back it up outside content snapshots; content restore must not replace it. The service refuses a missing or malformed key and never generates one on startup. Losing or changing it leaves older recovery incomplete. The Docker fixture initializes one key atomically in its owned private volume, independently of public signing trust. No key bytes enter receipt bodies or clients.

`RELAY_HOST` and `RELAY_PORT` select the listener. Source defaults to 127.0.0.1:8080; the image defaults to 0.0.0.0:8080. Port 0 selects a free port. Supply deployment configuration through the environment/secret manager when running the image. SIGINT/SIGTERM stop HTTP admission and storage work concurrently. Content operations own cancellable client leases; request disconnection or shutdown cancels the current PostgreSQL backend through a separate same-role control connection before destroying its lease. Pending and late acquisitions are also released. Shutdown drains the control connection after its cancellations, so neither a saturated content pool nor an external table lock retains owned queries. Already authorized operations may finish; revocation affects renewal, and access has its original finite expiry. GET /health is liveness only. The public relay HTTPS ingress, manager login routing, key rotation and live role/network isolation still need deployment validation.

The smoke generates HTTPS trust inside each run's owned volumes, so cached images contain no expiring certificate. Only the generator and authority receive the private-key volume; only the manager receives TLS private keys; the relay receives signing public trust read-only, and the smoke receives only the TLS public certificate. All TLS volumes are removed with the run. It uses separate manager/relay roles, no host ports and no source mounts. Its default isolated subnet is 10.254.237.0/24; `RELAY_TEST_SUBNET` may select another inspected unused subnet. Other projects' networks are never removed. RustFS success is not live Spaces proof. See [S3 GetObject ranges](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), [multipart limits](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html) and [checksum semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html).

## Infrastructure boundary

The portable Compose deployment is described in the
[deployment guide](0012-portable-cloud-deployment.md). Deployment files live under
`infra/`, separate from the service source. The DigitalOcean module lives in
`infra/terraform/`; Prompt Studio's own environments and secrets live in a separate
repository.

CI runs the relay's ordinary package checks through Lerna and an isolated Docker smoke job when the relay or shared tooling changes. See [package boundaries](../../references/architecture/0013-package-boundaries.md) for dependency rules. The relay stays private and is excluded from Changesets publication. Shared model changes also require the packaged CLI checks because local storage and the SDK test adapter bundle that model.
