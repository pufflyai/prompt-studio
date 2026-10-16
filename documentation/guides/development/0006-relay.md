# Relay development

The private `pstdio-relay` workspace under `infra/relay/` owns transactional PostgreSQL storage for shared extension groups. Its network listener serves liveness only. Authenticated transport, the production object adapter, account management, and deployment remain separate work.

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

The generated schema has four tables: scoped stream metadata, current records, immutable operation bodies with receipts, and conflict metadata. The owner uses `pg` with Drizzle and stores JSONB objects so indexed resolution captures remain searchable. Each write locks the scope row. Candidate records, conflict revisions, receipt, and replay position commit together. Exact retries return the saved receipt; changed operation bodies cannot reuse an ID. Pending attempts keep their identity and journal order.

`assets.complete(scope, asset)` must verify complete immutable bytes and keep them available through publication and retained history. The PostgreSQL owner checks this port before accepting references. This ticket supplies the port; its RustFS fixture is not the production object adapter or a cleanup policy.

Snapshots and replay use repeatable-read transactions. Replay contains complete accepted groups. Invalid cursors, gaps, and old epochs require snapshots. Restore checks the scope, sealed receipt bodies, and assets needed by both current records and retained non-pending receipts. It replaces content atomically and creates a new epoch. Historical receipts retain their original acknowledgments; new replay starts at the restored boundary. Grants are outside content restore.

Schema changes start in `infra/relay/src/storage/schema.ts`. Generate migrations with:

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

## Run the isolated smoke check

```sh
bun run --cwd infra/relay test:isolated
```

This command builds the Docker runtime and smoke images, starts PostgreSQL and RustFS, creates a test bucket, and checks:

- The built relay responds to `GET /health` with HTTP 200.
- The built production storage library migrates PostgreSQL, accepts a mixed record/asset group, and preserves the receipt and replay after reopening.
- S3-compatible storage preserves random bytes and supports deletion.
- Docker stop sends SIGTERM and the relay exits with code 0.

These checks exercise production persistence with a test object port. They do not prove authenticated network synchronization, production object streaming, provider compatibility, backups, initial download readiness, or the parent's fixed workload and cost gates.

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

The isolated smoke image reads `RELAY_URL`, `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` from the test Compose file. These configure the test clients; they are not relay storage APIs or production defaults. RustFS is a local S3-compatible fixture. See the [Bun S3 client](https://bun.sh/docs/runtime/s3) and [RustFS container documentation](https://docs.rustfs.com/en/installation/container/docker) for those fixtures' interfaces.

## Infrastructure boundary

Future Terraform configuration belongs under `infra/relay/terraform/`, separate from `src/`. This scaffold defines no resources, backend, remote state, provider credentials, or deployment workflow. Terraform state, local variable files, and working data are ignored by Git; the Terraform directory and relay environment files are excluded from Docker build contexts. Never commit application secrets or generated runtime data.

CI runs the relay's ordinary package checks through Lerna and an isolated Docker smoke job when the relay or shared tooling changes. See [package boundaries](../../references/architecture/0013-package-boundaries.md) for dependency rules. The relay stays private and is excluded from Changesets publication. Shared model changes also require the packaged CLI checks because local storage and the SDK test adapter bundle that model.
