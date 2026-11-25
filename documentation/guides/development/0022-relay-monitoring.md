# Relay monitoring

The implementation belongs to the repo-local [Relay monitoring extension](../../../.pstdio/extensions/relay-monitor), under RB1's product boundaries. The host supplies public extension APIs, connection secrets, navigation and chart components. The relay and manager expose optional private diagnostics. Collection, history and alerting continue when Prompt Studio is closed.

## Reuse an existing Grafana collector

Grafana is the dashboard. [Alloy](https://grafana.com/docs/alloy/latest/collect/opentelemetry-to-lgtm-stack/) can continue collecting metrics and logs while this extension supplies the relay dashboard. Reuse a deployed Alloy and compatible backends after checking their versions, query endpoints, recording-rule support, write credentials, retention and alert ownership. Grafana Cloud or another managed backend needs an equivalent adapter at the gateway; its provider-specific authentication is not assumed by the reference proxy.

The gateway health response also reports metrics, logs and alerts readiness as fixed boolean fields. The combined gateway exposes authenticated GET `/health`, `/prometheus/api/v1/query`, `/prometheus/api/v1/query_range`, `/loki/api/v1/query_range` and `/alerts/api/v2/alerts`. `/health` returns `{status:"ok",environment:"production",schemaVersion:1}`. The extension checks the environment before querying. Install the supplied recording rules in the existing ruler. Retain the metric names, units, bounded labels and freshness timestamps in the reference configs.

Do not run duplicate scrapers against the same series without replica deduplication. Keep a deployed Grafana dashboard available during migration until fault injection and alert delivery are accepted. Removing Grafana does not remove Alloy, historical storage, alert rules, receivers or the external watchdog.

## Reference deployment

The optional [Terraform module](../../../infra/monitoring/terraform) creates **one** smallest Basic VM (`s-1vcpu-512mb-10gb`: 1 vCPU, 512 MiB RAM, 10 GiB included disk) and a restricted firewall. The [published VM price](https://www.digitalocean.com/pricing/droplets) is $4/month as checked on 2026-11-22. There is no replica, paid block volume, separate probe host, reserved address, paid VM backup or new managed database cluster. Only authenticated HTTPS ingestion and queries are public; raw Prometheus, Loki, Alertmanager, OTLP and application metrics ports have no public ingress. SSH uses a dedicated public key and explicit administrator CIDRs. Configure DNS to the VM address for Caddy's TLS certificate.

Connect over SSH as `monitoring` with the dedicated key and use `sudo -n` for installation. Password authentication and direct root login are disabled. This avoids the image's initial root-password expiration flow.

Run `sudo -n bun /opt/relay-monitoring/prepare-host.ts` before pulling the application images. The dedicated host profile stops and masks multipath, modem and desktop disk-manager units to recover memory, and removes the unused bootstrap image without forcing removal of any running image. It also reserves one root-only 256 MiB swap file on the included disk and requires at least 1 GiB of root free space afterward. The monitoring service repeats this setup before starting. Measure actual available memory and disk space; the VM's advertised 512 MiB is not all available to application processes. See [temporary host swap](../../adrs/0163-temporary-monitoring-host-swap.md) for limits and removal.

Monitoring watches the production relay and manager; there is no separate staging environment. The monitoring VM runs the backends, observer, probe and watchdog. The production App Platform relay component runs the service collector through the `monitoring` input on `infra/terraform`. The observer uses a SELECT-only login on the production relay database, and the probe uses a dedicated monitoring account on production. Monitoring reuses the existing PostgreSQL server and adds no databases or buckets. Verify existing connection, storage and transfer headroom; reuse does not make consumption unlimited. The incremental VM target is $4/month, plus metered storage/transfer, notification and watchdog charges if applicable. Do not increase VM size or add instances automatically. Qualify boot, image/rollback disk space, active collection, encrypted multipart traffic, queries, restart and disk exhaustion before accepting the smallest profile. An idle measurement alone is insufficient. Use encrypted remote Terraform state restricted to infrastructure operators.

```sh
terraform -chdir=infra/monitoring/terraform init
terraform -chdir=infra/monitoring/terraform plan -out=monitoring.tfplan
# Review the plan and cost, then apply the reviewed plan through the operator workflow.
docker build -f infra/relay/Dockerfile --target runtime -t <registry>/relay:<revision> .
```

Use an immutable relay image digest as `MONITORING_IMAGE`. That image contains gateway, observer, probe and watchdog entry points, plus the optional service collector. Vendor image digests are pinned in Compose; review and update those pins together after configuration validation. Build from the repository root. The manual [Relay Monitoring Preview](../../../.github/workflows/relay-monitoring-preview.yml) workflow publishes revision-specific relay and account-manager preview tags to their existing packages.

Copy `infra/monitoring` to `/opt/relay-monitoring`. Cloud-init installs Docker, Bun and the supplied disk service and memory slice. The disk service allocates fixed ext4 files on the included disk: Prometheus 768 MiB, Loki 768 MiB, Alloy 384 MiB and checkpoint 128 MiB (2 GiB total). Each is mounted separately so full logs or a collector WAL cannot consume checkpoint space. Existing images are never reformatted. Install `relay-monitoring.service` after configuration; it refuses to start unless all four mounts exist. Keep space for the OS, Docker, current images, one rollback and rotated logs. Monitor actual root and mount headroom independently.

Run `bun infra/monitoring/configure.ts`. It creates three distinct credentials with mode 0600 and renders the production rules. It preserves existing gateway credentials. On Linux, chown state directories to the image UIDs printed by the command. Allow uid 1000 to read only its mounted secret files; restrict the parent directory to operators.

Set `MONITORING_IMAGE=<your-image>@sha256:...` and `MONITORING_HOST` in the ignored `.env`. Copy `alertmanager.example.yaml` to `secrets/alertmanager.yaml`, replace its placeholder with a real authenticated receiver, and configure its separate alerting dead-man receiver. Test resolved and firing notifications. Alertmanager receiver secrets stay in the mounted file. The backend refuses to start with a missing receiver file; an example address is not a working notification route.

```sh
docker compose --env-file infra/monitoring/.env -f infra/monitoring/compose.yaml config -q
sudo systemctl enable --now relay-monitoring.service
```

The shared systemd slice reclaims above 256 MiB, caps application memory at 384 MiB and swap at 256 MiB, and allows one CPU. OS and Docker overhead must be measured separately; do not infer physical fit by subtracting the application cap from the advertised VM size. Per-container limits are secondary bounds, not a memory allowance that can be summed. Prometheus retains up to 30 days or 512 MB, whichever fills first; Loki has 14-day time retention within its fixed disk, so ingestion can fail earlier. Retention is a target, not a guaranteed history window; preserve and display missing intervals. Container logs rotate at two 2 MB files. The collector uses a two-hour WAL, two send shards and bounded batches. The supplied telemetry alerts detect ingestion rejections and rule failures; they do not replace an independent disk-space alert. Query responses and ingestion requests are capped at 2 MiB, query execution at 10 seconds, metric series at 50, log results at 200, and query ranges at 30 days. The extension displays at most 1,200 points per series and limits active queries to two across command invocations.

## Private service collection

The existing `infra/terraform` App Platform module accepts optional `monitoring` input; it defaults to disabled. Supply separate HTTPS metric/log write URLs and credentials. The production relay and manager then report `MONITORING_ENVIRONMENT=production`. Alloy runs inside the existing relay component, receives OTLP on private port 4318 and scrapes relay/manager private port 9464. It does not add paid App Platform services or workers. The supervisor restarts a failed collector independently, passes it only collection settings, and reaps both children on shutdown. Collector failure leaves relay serving. The ordinary `/health` response is unchanged and does not expose diagnostics.

The monitoring service uses the relay's exported inspection API, the sync protocol/encryption packages and shared telemetry. It does not load the host runtime or read the manager database.

The module creates `relay_monitoring`, a separate database login. Before enabling the VM observer, run `infra/monitoring/readonly-role.sql` against the production relay database with `psql -v observer_role=<dedicated-role>`. It grants SELECT on five metadata tables, read-only transactions, two connections, a 10-second statement timeout and a 3-second lock timeout. Verify effective grants, denied writes and denied access to the manager database. Append the exact VM IP to the existing database firewall owner through `database_trusted_monitoring_ips`; preserve the App Platform rule. Do not grant object-store access, manager database access, `pg_monitor` or a migration-owner role. The observer cancels only its own operations. It takes one bounded read-only snapshot per configured account every 15 minutes and republishes observations every 30 seconds with the original observation times.

Example **private** observer configuration (`/run/secrets/observer.json`):

```json
{
  "environment": "production",
  "databaseUrl": "postgresql://<role>:<password>@<private-host>:<port>/<relay-db>?sslmode=verify-full&sslrootcert=/run/secrets/database-ca.pem",
  "gracePeriodMs": 604800000,
  "accounts": [{ "alias": "monitoring", "accountId": "<dedicated-account>", "quotaBytes": 53687091200 }]
}
```

Mount the existing managed database CA at the configured path and use `sslmode=verify-full`; never disable certificate verification. The Terraform module exposes the observer URL and CA as sensitive outputs for the operator. Match quota and grace values to the actual relay configuration. At most 20 explicit account aliases are accepted. Aliases must be nonpersonal operator names; identifiers never become exported labels. Storage graphs cover those configured accounts, not an unmeasured fleet total.

Optional `provider` configuration takes `{token,appId,component,expectedInstances}`. Use a token scoped to monitoring reads. CPU/memory and observed instance count come from the [App Platform monitoring API](https://docs.digitalocean.com/products/monitoring/reference/api/); no provider token reaches the extension. Droplet resources are unsupported by that adapter. Without a supported source the resource chart stays empty and infrastructure health stays unknown. Provisioning tokens must never be passed to this observer. Database health means the observer query succeeded; database connection-pool headroom and pending-deletion oldest age are unsupported by this metadata contract and must not be fabricated.

Optional `backup` takes `{lastSuccessAt,lastRestoreAt}` as ISO timestamps. The backup owner updates the mounted file (or redeploys the secret environment value) only after actual completion and restore verification. No evidence means unknown health. Evidence over 48 hours old or a restore drill over 90 days old fails the backup check. Monitoring history is disposable; back up configuration, secret references and the probe checkpoint separately, encrypted and off-host. Restore those before restarting collection, preserve the history gap, and test notification recovery.

## Encrypted canary and external watchdog

Create one dedicated monitoring account and workbench on production through the normal account workflow. Enroll **two separate devices** with independent credentials and IDs. The probe uses the same published sync protocol as clients: each device fetches keys independently; one seals updates/states/blobs/live payloads and the other reads and decrypts them. It has no bypass credentials, customer workbench access or manager signing keys.

On the monitoring VM, provide ignored `secrets/probe.json` matching `services/relay-monitoring/src/probe-config.ts`. Set `enabled:true` and `dedicatedMonitoringAccount:true`, `environment:"production"`, production manager/relay HTTPS origins, account/workbench IDs, both device records `{credential,renewalGrant,deviceId}`, `checkpointDirectory:"/checkpoint"`, and budget `{queryOrigin,readToken,accountAlias:"monitoring",maximumBytes:104857600}`. Its query credential can only read. Use the observer's `monitoring` alias for this account. A missing, failed or older-than-20-minute quota observation stops sync/blob writes and reports unknown state; HTTP, access and live checks continue. Co-location saves a VM but loses an independent region vantage and shares the host failure domain; the external dead-man receivers are therefore essential.

The probe runs every five minutes, with a 30-second round deadline. It sends a 256-byte update and replaces the latest state, checks a 4 KiB blob every 15 minutes, and exercises a two-part 6 MiB blob weekly. Old unreferenced blobs and covered data retire through normal cleanup. The hard budget is at most 100 MiB and reserves headroom before each write. Pending sealed envelopes and ciphertext are atomically checkpointed and fsynced before sending; lost replies reuse their IDs. Run exactly one probe owner under the supplied `flock`. Restore the checkpoint after host loss. Do not erase it to work around a failed operation.

Provide `secrets/collector.env` with `MONITORING_ENVIRONMENT=production`, `RELAY_HEALTH_URL`, `METRICS_WRITE_URL` and `METRICS_WRITE_TOKEN`. Alloy performs HTTPS/DNS/TLS checks, scrapes observer and canary metrics and removes target URLs before storage. The reader has no write capability and the ingestion credential has no read capability.

The always-firing `MonitoringAlertingHeartbeat` rule sends through Alertmanager to a **separate** external dead-man receiver every minute. Configure a five-minute missed-ping alarm there. This proves the rule, Alertmanager and notification path can deliver; use a different receiver URL from the probe watchdog so one path cannot mask the other.

Set `secrets/watchdog.json` to `{environment:"production",queryOrigin,readToken,watchdogUrl}`. The watchdog URL must use HTTPS and belong to a dead-man receiver outside the VM. Configure a three-minute missed-ping alarm. Every minute this process checks metrics, logs and Alertmanager readiness plus fresh monitoring-source evidence through the gateway, and pings only on success. A down backend, failed ingestion path, lost host or missed freshness deadline therefore stops pings. Test it by stopping the watchdog and, separately, blocking access to the query gateway. Use the single Compose stack above.

## Local extension and acceptance

Install with `pst extensions dev .pstdio/extensions/relay-monitor`. Open the extension's Connections settings and enter the reader address/token from the private `secrets/connection.json`. The `monitoring-production` connection is a host-local secret. No source file, synced extension setting or browser bundle stores a token. The page is in LOCAL mode and commands reject remote workspaces and automation/schedule/event invocation.

The runtime never imports Canvas fixtures. An empty or failed source produces gaps and unknown checks. Query time and source observation time are separate. The default view contains a five-lane timeline and six large charts; other sections share the range control. Capacity includes the separately measured 100 MiB probe budget. Infrastructure shows observed build identities from the relay image digest. Inspect data exposes observations without making tables the main experience. Failure details share the selected range, decode only fixed operation codes, and paginate inclusively at timestamp boundaries. If 200 entries share one timestamp, the bounded view explicitly reports that source limit instead of skipping entries silently. Hidden views stop polling and abort their requests. Health bins reduce an explicit severity score so known failures survive bins that also contain unknown samples; they retain their worst observed state and latency bins retain maximum recorded quantiles, rather than averaging percentiles.

Before relying on the monitor, verify these cases on production using only the dedicated monitoring account and the monitoring stack: HTTP healthy with sync failure; corrupt or inaccessible blob; revoked device grant; failed live subscription; stopped observer/collector; quota budget exhaustion; cleanup past its deadline; absent/old backup evidence; backend restart/history gap; reader credential rotation/revocation; blocked write endpoints; and missed watchdog pings. Revoke a reader credential and confirm old browser state cannot become fresh. Verify no IDs, credentials, object keys, payloads, raw errors or deployment addresses appear in telemetry or public evidence. Test one real firing notification and its resolution. Keep this acceptance evidence private.

The extension is read-only. Roll back by disabling it; collection and alerts keep running. Roll back service instrumentation by removing monitoring environment variables. Keep the previous image digest and collector configuration for server rollback. Do not delete data images or Terraform resources as part of an application rollback; `prevent_destroy` protects the VM. Paid VM backups are disabled: encrypted off-host configuration and checkpoint backups and a verified restore remain operator responsibilities. Absent backup evidence stays unknown.
