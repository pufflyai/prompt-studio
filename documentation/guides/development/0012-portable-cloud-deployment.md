# Portable relay and account manager

PS-786 packages the [blind relay](../../references/architecture/0029-blind-relay.md)
and the [account manager](0007-account-manager.md). Service code lives under `services/`;
deployment files live under `infra/`. Neither image needs a source checkout, a runtime
package install or developer credentials. Both run as the unprivileged Bun user.

This guide prepares deployment. It does not authorize cloud resources or spending.

## Release images

[Service containers](../../../.github/workflows/service-containers.yml) builds both
images in the release pipeline. It builds the exact release commit, keeps the verified
images as artifacts, and publishes them before completing the GitHub release. Pull
requests run only its fast contract and Terraform checks:

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

## Reference workload measurement

PS-787 adds a manual [reference workload](../../../packages/e2e/src/perf/relay-reference-workload/workload.diagnostic.ts).
It uses this guide's Compose relay, migration job, PostgreSQL and real RustFS object
storage. It replaces public ingress with loopback ports and uses disposable signed
identities. It does not create cloud resources or open the user's local database.
The three clients use independent new fixture databases and digest-checked file stores.
The account manager and Google login are outside this local measurement.

Build the relay image from the revision you want to measure, then run from the repository root:

```sh
docker build -f infra/relay/Dockerfile --target runtime -t pstdio-relay:measurement .
bun packages/e2e/src/perf/relay-reference-workload/workload.diagnostic.ts \
  .pstdio/extension-storage/pstdio.pstdio-artifacts/relay-measurement \
  pstdio-relay:measurement
```

The run keeps these workloads fixed:

- Reference: two projects with 5,000 records each, three devices, and 5 GiB of
  distinct files: one 1 GiB file and eight 512 MiB files. A second account syncs
  during the first file's actual multipart transfer. Each project receives 10,000
  record edits in groups of 100. A joined device catches up, then a fresh device
  downloads the result. Every record value and every file digest is checked.
- Scale: ten extension owners with 10,000 records each on three devices. Each
  owner also receives 10,000 edits. This separate account runs on the same relay
  after the reference workload; raw server totals are cumulative, and the output
  reports the scale workload's additional object and table storage separately.
- Large save: one grouped save of eight 150,002-byte record values after a small
  founding state. It must use a blob-backed update frame, replace the latest state
  using the default trigger, and produce the same values on three devices. Pass
  `large-save` as the final command argument to run only this focused check.

The runner keeps the normal relay limits, seven-day grace period, and production
latest-state trigger. R23 counts the encrypted state envelope, chunk blobs, large-save
frame blobs and retained updates. File blobs have a separate bound so the large files
cannot hide record-history growth. Covered frame blobs count once in the grace copy.
Physical object keys and lengths must match the database; unclassified blobs,
unmatched objects and unfinished uploads prevent a passing result.

Output includes per-owner limits, every relay table's row count and allocated bytes,
object listings, first-download/catch-up request counts, source hashes and raw HTTP
observations. Request counts cover calls made by the production client. Response
bytes count application bodies consumed by the client; cancelled acknowledgments and
HTTP/TLS overhead are excluded. They are a traffic lower bound, not billed wire bytes.
Keep explicit overhead headroom when estimating monthly traffic.

Allow roughly 30 GiB of free disk for the full file workload. The runner discards a
verified follower's fixture files before downloading the third device's copy. It
removes only its named Compose project, volumes and temporary device files, including
on SIGINT/SIGTERM. Result files remain. A forced process kill can require manual
cleanup using the exact Compose project and configuration printed by Docker.

Local results establish a measured workload, not unlimited capacity, a hosted SLA,
or Spaces compatibility. A host with a large shared Docker memory limit does not
establish that the cheapest App Platform instance can sustain the same workload.

### Local results, 2026-10-30

The corrected reference run passed on an Apple M5 with 32 GiB RAM, Bun 1.4.4 and
Docker Desktop. It took 553.533 seconds. Three independent fixture clients verified
all record values and complete file digests. The second account synced in 163.360 ms
inside the 1 GiB file's 7.413-second, 205-part transfer window.

| Encrypted payload unit | Stored bytes | R23 limit bytes |
| --- | ---: | ---: |
| Project 1 record stream | 87,115,658 | 102,101,101 |
| Project 2 record stream | 87,129,586 | 102,122,815 |
| Project 1 files | 3,221,225,637 | 6,442,451,274 |
| Project 2 files | 2,147,483,780 | 4,294,967,560 |

Each project received 10,000 edits. The second account's small stream also passed.
All 217 physical objects reconciled to 5,542,956,490 bytes, with no unknown,
missing or mismatched objects, missing mappings or unfinished uploads. This uses the
existing storage-bound benchmark's encrypted-payload interpretation of R23. SQL
allocation is reported separately: 1,507,328 table/index bytes and a 9,567,255-byte
PostgreSQL database at the reference endpoint. These local allocations do not prove
hosted instance capacity. Raw evidence is attached to PS-787's change request report.

The separate ten-owner run also passed in 3,114.578 seconds. It verified all 100,000
records after 100,000 edits on each of three devices. Every owner retained two state
rows, 68 update rows and 31 chunk objects. Per-owner stored record bytes ranged from
154,831,287 to 154,906,469, below the corresponding limits of 202,891,835 to
203,000,987 bytes. Scale added 1,010 objects and 1,548,790,489 bytes. Cumulative
physical storage was 1,227 objects and 7,091,746,979 bytes, all reconciled. Cumulative
table/index allocation was 3,588,096 bytes; database size was 11,951,127 bytes.

| Client phase | Reference requests | Reference response-body bytes | Scale requests | Scale response-body bytes |
| --- | ---: | ---: | ---: | ---: |
| Initial follower download | 25 | 5,385,472,201 | 100 | 167,709,191 |
| Joined device catch-up | 26 | 96,302,278 | 200 | 711,587,637 |
| Fresh device download after edits | 39 | 5,465,013,053 | 220 | 711,594,447 |

These are complete relay client-call counts for each phase, including state and blob
reads. They are not S3 operation counts. No client request failed in either run.

The reference and scale runs used relay source base `48b14bc13` and the recorded
measurement-source hashes. They exercised inline grouped updates. A later focused
large-save run verified the client compaction fixes: one blob-backed frame, three
devices, six physical objects and 2,404,755 stored bytes below its 3,607,028-byte limit.
It passed in 1.261 seconds on the same relay image. Regression tests also verify
compaction when a new device inherits a large update tail after an interrupted
latest-state upload. Each result retains its own source and image provenance.

The combined fixture-client process reached a peak physical footprint reported as
`14.2G` by macOS `sample`. That process holds several simulated devices; it is not a measurement
of one production device. The run used a shared Docker VM with a 15.6 GiB limit and
no exclusive timing window. It proves this finite workload's local correctness and
storage figures, without a general memory, latency or hosted-capacity acceptance claim.

## Existing deployment and monthly estimate, verified 2026-10-30

The existing production deployment is active at `https://base.prompt.studio` in
Amsterdam. Read-only provider API inspection confirmed two `basic-xxs` services,
each with one shared CPU and 512 MiB RAM. The active deployment was created on
2026-10-28. Its immutable service images match the Cloud repository's production inputs:

| Service | Active image digest |
| --- | --- |
| Relay | `sha256:1da1a81261d1e440be84945a7804be6a8695e7683512cc2d30141b0a4f1e5187` |
| Account manager | `sha256:a835ea6009d228daf5e27e96d84c05047f5fee7b0057a4dfab74a4d32d7852b1` |

The database is an online PostgreSQL 16 server in `ams3`, size
`db-s-1vcpu-1gb`, with one node and 10 GiB disk. The existing landing app is a
static site. Its October invoice preview shows it inside the free allowance.
The September invoice and October preview both charge zero added tax. This is
observed billing treatment, not a claim about a legal exemption or future tax rules.

The relay bucket listing contained 15,033 objects and 17,871,016,297 bytes across
16 pages. This is a live listing observed during the inspection, not an atomic
relay/SQL reconciliation. The local workload audits above provide that separate
correctness evidence. No object content was read, no deployment was changed and no
paid resource was created. Sanitized provider and billing evidence is attached to
PS-787's revision report. Credentials remain in private operator configuration.

### Finite monthly workload

Budget traffic for thirty complete reference runs plus one ten-owner scale run per
month. Repeated transfers do not imply thirty users or thirty retained datasets.
The reference profile uses one primary account with two projects. The separate scale
profile uses ten extension owners on one account; it is not a ten-user benchmark.

| Storage observation | GiB | Scope |
| --- | ---: | --- |
| Reference test endpoint | 5.162 | 10,000 records, 5 GiB of files and retained record history. |
| Ten-owner scale increment | 1.442 | 100,000 records after 100,000 edits; no additional file payload. |
| Both isolated test endpoints together | 6.605 | Measured test storage, separate from production. |
| Existing production bucket | 16.644 | Live metadata listing at the inspection time. |

The 180 GiB figure below is an optional fixture-retention stress ceiling. It counts
thirty independent full reference copies, the existing production inventory, the
scale increment and 1 GiB backup allowance: 173.955 GiB rounded up. That amount was
not stored, provisioned or required by the ten-owner test. It is not expected user
storage. The current Spaces subscription costs the same US$5 while retained data
stays within its included 250 GiB, whether the test footprint is 6.605 GiB or the
larger retention stress case is used.

The recorded calls total 60,830 for this scenario. Budget traffic as follows:

- App Platform outbound: consumed response bodies plus all offered request bodies,
  times 1.25, plus 1 KiB per call: 585.714 GiB/month. Count both client downloads and
  relay-to-Spaces upload forwarding; assume no upload-transfer exemption.
- Spaces outbound: consumed response bodies plus all offered request bodies, times
  1.25, plus 1 KiB per call: 585.714 GiB/month. The offered bodies reserve an extra
  durable verification read for uploads. The relay verifies uploaded objects by
  reading them back. Count client downloads as well; assume no transfer exemption.

These are explicit planning allowances from the measured bodies, not provider wire
counters or a proven upper bound on internal reads. Cancelled acknowledgements and
HTTP/TLS overhead are absent from the raw body counters. Reprice if actual traffic,
retention, read amplification or monthly repetition exceeds these allowances.

Reserve US$1/month for migration jobs. At the inspected per-second price, thirty
deployments with two ten-minute jobs each cost about US$0.075 before any minimum
charges; the reserve also covers sixty US$0.01 job minimums. The current invoice
preview charges US$0.01 for manager migration jobs and zero for relay migration
jobs. Standard managed database backups are part of the database plan; existing
backup objects share the storage allowance. This estimate creates no backup job.

PostHog is priced within one analytics project's published free allowance: at most
one million analytics events and 5,000 recordings per month, with no paid platform
package or other paid product. Landing transfer stays within its 1 GiB free tier.
These are finite reference-workload limits, not an audit of unrelated subscriptions.

### Inclusive cost model

The first column allocates the two services' API-confirmed 80 GiB App Platform transfer
pool and the Spaces subscription's 250 GiB storage/1,024 GiB transfer allowances.
The combined stress column credits none of those shared allowances and charges
the optional 180 GiB fixture-retention ceiling again at the overage rate. It combines
exhausted shared allowances with deliberately excessive fixture retention; it is
not a forecast of normal user storage.

| Item | With allocated allowances, USD/month | Combined allowance/retention stress, USD/month | Basis |
| --- | ---: | ---: | --- |
| Relay | 5.00 | 5.00 | Verified single `basic-xxs` container; [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/). |
| Account manager | 5.00 | 5.00 | Same verified container size and price. |
| Databases and standard backups | 15.15 | 15.15 | Verified basic 1 GiB node/10 GiB disk; [database pricing](https://www.digitalocean.com/pricing/managed-databases). |
| Object and backup storage | 5.00 | 8.60 | Full subscription plus, in the second column, 180 GiB at US$0.02/GiB; [Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/). |
| Traffic | 10.11 | 17.57 | App Platform US$0.02/GiB; Spaces US$0.01/GiB; both transfer paths counted. |
| Migration-job reserve | 1.00 | 1.00 | Monthly job limits above; actual running jobs are billed per second. |
| Landing page | 0.00 | 0.00 | Existing static app is in its free allowance; maintain the stated transfer limit. |
| PostHog | 0.00 | 0.00 | Stated event/recording limits within the [free allowance](https://posthog.com/pricing). |
| Added taxes | 0.00 | 0.00 | Observed zero charge on inspected invoices; [billing tax rules](https://docs.digitalocean.com/platform/billing/taxes/). |
| **Total** | **41.26** | **52.32** | Uses unrounded values before rounding the final total. |

The allocated-allowance model leaves US$8.74 below the US$50 target for this finite
workload under the observed tax treatment. It includes a job reserve, backup
storage and both traffic paths. The no-credit stress case exceeds the target by
US$2.32: exhausted shared allowances combined with the optional 180 GiB
fixture-retention stress ceiling exceed the budget. At a hypothetical 25% added
tax, the two models become US$51.58 and US$65.40, so neither passes. Actual
PostHog paid features, extra containers, larger database plans or higher usage also
require repricing.

The deployed versions and prices are verified facts. Monthly traffic repetition,
headroom and analytics limits are explicit operating assumptions. The optional
180 GiB fixture-retention ceiling is a separate stress case. Local correctness
and timing measurements do not prove that hosted 512 MiB instances meet a latency,
memory or availability target.
