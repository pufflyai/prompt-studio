# Relay development

The private `pstdio-relay` workspace under `infra/relay/` prepares the shared synchronization service. It currently serves liveness only. Synchronization, account management, production storage adapters, and cloud deployment come later.

## Build and check

Use Bun 1.4.2 and Docker with the Compose plugin. From the repository root:

```sh
bun install --frozen-lockfile
bunx lerna ls --all
bunx lerna run build,typecheck,lint,test --scope pstdio-relay
```

Bun and Lerna discover the relay through the root workspace list. Nx caches its build, type check, lint, and focused tests. The relay has no dependency on the local API host, UI, desktop client, or synchronization prototype. The shared synchronization contract belongs to PS-744.

## Run the isolated smoke check

```sh
bun run --cwd infra/relay test:isolated
```

This command builds the Docker runtime and smoke images, starts PostgreSQL and RustFS, creates a test bucket, and checks:

- The built relay responds to `GET /health` with HTTP 200.
- A temporary PostgreSQL table supports a write/read round trip.
- S3-compatible storage preserves random bytes and supports deletion.
- Docker stop sends SIGTERM and the relay exits with code 0.

The storage checks prove the disposable development services work. They do not prove relay persistence or provider storage compatibility. The relay does not connect to storage yet.

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

The final image contains Bun and the built JavaScript entrypoint. It needs no developer checkout, dependency install, mounted files, or cloud credentials. It runs as the unprivileged `bun` user.

`RELAY_HOST` and `RELAY_PORT` select the listener. Source execution defaults to `127.0.0.1:8080`; the image defaults to `0.0.0.0:8080`. The port must be an integer from 0 to 65535; 0 asks the operating system to choose a free port. SIGINT and SIGTERM stop accepting connections and let active requests finish. `/health` is liveness only, not a storage-readiness or authentication endpoint. Other routes return 404.

The isolated smoke image reads `RELAY_URL`, `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` from the test Compose file. These configure the test clients; they are not relay storage APIs or production defaults. RustFS is a local S3-compatible fixture. See the [Bun S3 client](https://bun.sh/docs/runtime/s3) and [RustFS container documentation](https://docs.rustfs.com/en/installation/container/docker) for those fixtures' interfaces.

## Infrastructure boundary

Future Terraform configuration belongs under `infra/relay/terraform/`, separate from `src/`. This scaffold defines no resources, backend, remote state, provider credentials, or deployment workflow. Terraform state, local variable files, and working data are ignored by Git; the Terraform directory and relay environment files are excluded from Docker build contexts. Never commit application secrets or generated runtime data.

CI runs the relay's ordinary package checks through Lerna and an isolated Docker smoke job when the relay or shared tooling changes. See [package boundaries](../../references/architecture/0013-package-boundaries.md) for dependency rules. The relay stays private and is excluded from Changesets publication. No CLI runtime files or built-in templates are changed.
