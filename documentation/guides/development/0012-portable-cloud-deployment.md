# Portable relay and account manager

PS-786 packages the [blind relay](../../references/architecture/0029-blind-relay.md)
and the [account manager](0007-account-manager.md). Service code lives under `services/`;
deployment files live under `infra/`. Neither image needs a source checkout, a runtime
package install or developer credentials. Both run as the unprivileged Bun user.

This guide prepares deployment. It does not authorize cloud resources or spending.

## Release images

[Service containers](../../../.github/workflows/service-containers.yml) builds both
images on relevant pull requests. The release pipeline builds the exact release
commit, keeps the verified images as artifacts, and publishes them before completing
the GitHub release:

- `ghcr.io/pufflyai/prompt-studio/relay`
- `ghcr.io/pufflyai/prompt-studio/account-manager`

Use the release version tag to find the image, then record its immutable digest.
The deployment examples require digests. A pull request build does not publish a
release. CI also runs the existing isolated relay smoke, which now uses the actual
manager runtime image and checks data and device removal after replacing both containers.
`bun infra/relay/smoke-portable.ts` runs the same relay smoke against the production
Compose topology, with separate databases and normal runtime roles. It replaces public
ingress with owned HTTPS fixtures and removes only its disposable containers and volumes.
The [diagnostics guide](0010-service-diagnostics.md) covers optional telemetry injection.

## Self-hosted Compose

Copy `infra/relay/compose.yaml`, `infra/relay/Caddyfile` and
`infra/relay/.env.example` to an operator folder; rename the last file `.env`.
No other repository files are needed. Use Docker with the Compose plugin.

Fill every `REPLACE` value. Database passwords must use URL-safe characters. Generate
independent random credentials for each database, object storage and Better Auth.
`BETTER_AUTH_SECRET` must contain at least 32 characters. Generate a recovery key once
with `bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"))'`.
Keep that key through upgrades and back it up outside relay content. Treat `.env` as
private operator data: restrict its permissions and keep it out of source control.

Point two public DNS names at the host. Allow ports 80 and 443 to Caddy, which obtains
and renews certificates and forwards WebSockets. The databases and object service have
no host ports. The relay cannot reach the manager database's private network, and the
manager has no object credentials. Containers share a host; this is not protection
against a host administrator. For stronger isolation use separate hosts or accounts.

Register a Google OAuth web client for the manager origin. Its redirect URI is
`https://<manager-domain>/api/auth/callback/google`. Keep the exact public origins in
`MANAGER_DOMAIN`, `RELAY_DOMAIN` and the relay's trust document.

Bootstrap in this order from the operator folder:

```sh
docker compose up -d --wait relay-db manager-db objects
docker compose --profile setup run --rm bucket
docker compose run --rm manager-migrate
docker compose up -d --wait manager ingress
```

The bucket command runs once for a new object store. On later starts use the existing
bucket. Before starting the relay, fetch the manager's `/api/auth/jwks` through its
verified HTTPS origin. Place the public response in `RELAY_ACCESS_TRUST` as
`{"issuer":"https://<manager-domain>","audience":"https://<relay-domain>","jwks":<response>}`.
Then run `docker compose up -d --wait relay`. The relay migration job completes before
the listener starts. `/health` is liveness; it does not prove storage or Google login.

Check both public `/health` URLs, complete a Google login from a client, sync a project,
and read it on a second client. Replace the containers with
`docker compose up -d --wait --force-recreate relay manager` and confirm the project
and device list survive. Never use `down --volumes` on a deployment you want to keep.

## Keys and recovery

The account manager's own PostgreSQL database contains project and personal-space
keys, older key generations, device grants and signing keys. Relay object storage
contains ciphertext. Its latest state and later updates are the content backup;
there is no relay backup bucket or backup worker.

Back up the manager database separately to an operator-controlled encrypted store
outside the relay host and its credentials. For Compose, capture a consistent full
database dump without writing it inside a service container:

```sh
docker compose exec -T manager-db pg_dump -U manager -d manager -Fc > /secure-key-backups/manager.dump
```

Restrict access before running this command. Encrypt and transfer the result to the
separate key backup store with your existing backup tooling. Capture it after key
creation and rotation, and before upgrades. A persistent volume alone is not a backup.
Keep `BETTER_AUTH_SECRET` in a separate secret store so encrypted OAuth and signing
material can be read after restore. Keep the relay recovery key separately as well.
Never put any of these secrets in the relay bucket. The operator owns scheduling and
verification; this deployment adds no backup worker.

Restore a full dump only into an empty manager database while the manager is stopped,
using `pg_restore --exit-on-error --no-owner -U manager -d manager`. A full database
restore also restores sessions and grants from its capture time. Reconcile each
account and require devices to log in again before reopening traffic. The account
manager's owned snapshot/restore API provides a safer grants reconciliation path when
restoring selected authority data; see [recovery](0007-account-manager.md) and
[the key model](../../adrs/0085-encrypt-sync-data-with-account-manager-keys.md).
Test restoration into an isolated database and confirm every key generation before
depending on a backup. A stale backup can lose newer keys; it does not promise zero
data loss. Clients with full local copies can upload lost relay data again.

Distribute new manager public signing keys to every relay before issuing tokens with
them. Retain old public keys until all their access tokens expire. Environment trust
uses `RELAY_ACCESS_TRUST` and the base64 recovery key uses `RELAY_RECOVERY_KEY`.
File injection through `RELAY_ACCESS_TRUST_FILE` and `RELAY_RECOVERY_KEY_FILE` remains
available. Environment values take precedence when supplied.

## Other platforms

The images run on any container platform. Give each service its own PostgreSQL
database and role, keep relay objects in a private S3-compatible bucket, and run each
service's migration with the same image before the service starts. For a managed
database, pass its CA certificate in `DATABASE_CA_CERT`; the container launcher writes it
to a private file and connects with `sslmode=verify-full`. Give the relay a
bucket-scoped key with read, write, multipart, list and delete access, and check it with
the [object contract probe](0006-relay.md#provider-contract).

Prompt Studio's own hosted service runs these images from a separate infrastructure
repository. This repository has no provider-specific deployment files.

## Migrations and upgrades

Test the release against restored disposable persistence first. Capture a manager key
backup, preserve object data, database volumes and recovery/auth secrets, and record
the old image digests. Stop writes while making changes that require downtime. Run
each migration once with its matching release image before admitting new traffic.
Compose dependencies enforce this order; on other platforms, run the migration first. Migration
failure must stop the upgrade. Do not automatically run older images against a newer
schema: database rollback requires a tested restore or a compatible forward fix.

Keep backups of every database and test a recovery before relying on it.
