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

Both images are public: anyone can pull them without logging in. GitHub creates a newly
published package as private and offers no API to change that. After an image's first
release, an organization owner opens the package settings and chooses Danger Zone >
Change visibility > Public, once; a public package cannot become private again. The
release checks that both images can be pulled without logging in, and stops before it
publishes the GitHub release if one cannot.

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

The account manager's own PostgreSQL database contains project keys, private-data
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

## DigitalOcean module

`infra/terraform/` is a Terraform module that runs both services on DigitalOcean App
Platform:

- One app on one host. The relay serves under `/relay` and the account manager under
  `/accounts`. App Platform removes the path before forwarding, as described in
  the [account manager guide](0007-account-manager.md).
- One PostgreSQL server with a database and login per service. Each service's migration
  revokes public access to its database and grants it to that service's login only, so
  the relay cannot reach the manager's keys.
- A private Spaces bucket for relay data.

Use it from your own Terraform configuration and pin it to a release, together with the
image digests of the same release:

```hcl
module "cloud" {
  source          = "git::https://github.com/pufflyai/prompt-studio.git//infra/terraform?ref=<release tag>"
  name            = "acme-production"
  host            = "cloud.example.com"
  dns_zone        = "example.com"
  app_region      = "ams"
  database_region = "ams3"
  spaces_region   = "ams3"
  bucket_name     = "acme-relay"
  image_digests   = { relay = "sha256:...", manager = "sha256:..." }
  relay_secrets   = var.relay_secrets
  manager_secrets = var.manager_secrets
}
```

`variables.tf` lists every input. Give clients the `manager_url` output:
`pst login --manager <manager_url>`, or set `PSTDIO_ACCOUNT_MANAGER_ORIGIN=<manager_url>` before starting the host and run `pst login`. Without an override, login uses `https://base.prompt.studio/accounts`. An explicit address takes precedence over the host environment setting. The manager tells each device the relay address.
Register `<manager_url>/api/auth/callback/google` in the Google OAuth client.

The relay must trust the manager's signing keys, and those exist only once the manager
runs. Deploy the first time with `services = ["manager"]`. Fetch
`<manager_url>/api/auth/jwks` and put the key set into `relay_secrets.RELAY_ACCESS_TRUST`
with issuer `<manager_url>` and audience `<relay_url>`. Then deploy both services.

Plan the module without credentials or cloud calls:

```sh
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform/validation init -input=false
terraform -chdir=infra/terraform/validation validate
DIGITALOCEAN_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
SPACES_ACCESS_KEY_ID=validation-only SPACES_SECRET_ACCESS_KEY=validation-only \
terraform -chdir=infra/terraform/validation plan -refresh=false -input=false
```

The plan adds 8 resources. It checks the provider schema and the dependency graph, not
live credentials, DNS or provider capacity. Never apply the validation inputs. State and
plans contain secrets even when the output hides them: keep them in a private backend
with locking. Prompt Studio's own hosted service uses this module from a separate
repository that holds its environments, state and secrets.

## Other platforms

The images run on any container platform. Give each service its own PostgreSQL
database and login, keep relay objects in a private S3-compatible bucket, and run each
service's migration with the same image before the service starts. For a managed
database, pass its CA certificate in `DATABASE_CA_CERT`; the container launcher writes it
to a private file and connects with `sslmode=verify-full`. Give the relay a
bucket-scoped key with read, write, multipart, list and delete access, and check it with
the [object contract probe](0006-relay.md#provider-contract).

## Migrations and upgrades

Test the release against restored disposable persistence first. Capture a manager key
backup, preserve object data, database volumes and recovery/auth secrets, and record
the old image digests. Stop writes while making changes that require downtime. Run
each migration once with its matching release image before admitting new traffic.
Compose dependencies and App Platform pre-deploy jobs enforce this order. Migration
failure must stop the upgrade. Do not automatically run older images against a newer
schema: database rollback requires a tested restore or a compatible forward fix.

Keep backups of every database and test a recovery before relying on it.
