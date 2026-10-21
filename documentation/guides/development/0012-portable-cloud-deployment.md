# Portable relay and account manager

PS-786 packages the [blind relay](../../references/architecture/0029-blind-relay.md)
and the [account manager](0007-account-manager.md). Service code lives under `services/`;
deployment files live under `infra/`. Neither image needs a source checkout, a runtime
package install or developer credentials. Both run as the unprivileged Bun user.

This guide prepares deployment. It does not authorize cloud resources or spending.
Do not run `terraform apply` without separate approval.

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

## DigitalOcean plan

`infra/terraform/` describes two App Platform apps, separate managed PostgreSQL
clusters and roles, app-specific database firewalls and a private Spaces bucket.
Each app runs its own schema migration as a pre-deploy job using the same pinned
image as its service. Only that job gets the cluster owner's database credential.
It grants table and sequence access to the normal runtime role after migrations.
The service gets only its normal role credential. Both commands receive the cluster
CA through `DATABASE_CA_CERT`; the container launcher writes a private temporary CA
file and uses `sslmode=verify-full`. TLS terminates at App Platform. The manager's managed database
backup is separate from relay storage; also take the independent key backup described
above. Approve region, database and app sizes through the PS-787 cost check before
deploying. There is no provider-specific code in either service.

Mirror each released image digest to DigitalOcean Container Registry and supply its
`repository` and `digest` in `images`. The provider's DOCR source avoids building the
repository during deployment. Create a bucket-scoped read/write Spaces key for the
relay, with multipart, list and delete access; Terraform's provisioner credentials
must remain separate. Validate the key with the [object contract probe](0006-relay.md#provider-contract)
against a disposable existing bucket when live provider testing is authorized.

Install Terraform 1.10 or newer, below 2.0. The provider is locked. Check and inspect an
empty validation workspace without real credentials or remote reads:

```sh
terraform -chdir=infra/terraform init -backend=false -input=false
terraform -chdir=infra/terraform fmt -check
terraform -chdir=infra/terraform validate
DIGITALOCEAN_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
SPACES_ACCESS_KEY_ID=validation-only SPACES_SECRET_ACCESS_KEY=validation-only \
terraform -chdir=infra/terraform plan -refresh=false -input=false -var-file=validation.tfvars
```

This plan has 11 additions, no changes and no deletions. It checks the provider schema
and dependency graph, not live credentials, DNS, provider capacity, backups or S3
compatibility. The synthetic values must never be applied. No cloud API write occurs.

For a first deployment, the manager must exist before the relay can trust its signing
keys. After separate deployment approval, prepare a manager-first plan with
`-target='digitalocean_app.service["manager"]'` and
`-target='digitalocean_database_firewall.service["manager"]'`. Review every included
dependency and cost; targeting the manager can also include shared plan dependencies.
Provision that reviewed bootstrap phase only within the approved deployment scope.
Verify the manager's public HTTPS origin and fetch `/api/auth/jwks`. Put the returned
nonempty key set into `relay_secrets.RELAY_ACCESS_TRUST`, with the exact manager issuer
and relay audience. Then produce and review a full plan before deploying the relay.
The synthetic empty JWKS is for planning only and cannot start a relay. Later upgrades
use full plans and preserve or rotate the existing public signing trust.

For an authorized real plan, use an operator workspace with real domains, released
digests, public signing trust and secrets supplied through protected `TF_VAR_*`
environment values or an untracked private variable file. Use
`DIGITALOCEAN_TOKEN`, `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY` for provider
credentials. Plans and state can contain secrets even when their display is redacted.
Keep them encrypted with access restricted to operators. Configure a protected remote
backend with locking before any shared deployment; this module deliberately has no
preselected backend or remote-state credentials. Do not run concurrent local applies.

## Migrations and upgrades

Test the release against restored disposable persistence first. Capture a manager key
backup, preserve object data, database volumes and recovery/auth secrets, and record
the old image digests. Stop writes while making changes that require downtime. Run
each migration once with its matching release image before admitting new traffic.
Compose dependencies and App Platform pre-deploy jobs enforce this order. Migration
failure must stop the upgrade. Do not automatically run older images against a newer
schema: database rollback requires a tested restore or a compatible forward fix.

Terraform prevents accidental destruction of database clusters and the Spaces bucket.
This does not replace backups or a recovery drill. A plan-only review does not prove
a production rollout or a released image exists.
