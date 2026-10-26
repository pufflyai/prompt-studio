# Service diagnostics

Manager and relay diagnostics use the existing selected EU PostHog project. The private `pstdio-service-telemetry` workspace owns the shared adapter under `services/telemetry/`. It is separate from browser analytics and is not included in the local host or CLI.

## Configuration

Delivery is off by default. To enable it in an authorized deployment, set all three variables on each service:

```sh
SERVER_TELEMETRY_ENABLED=1
TELEMETRY_ENVIRONMENT=staging
TELEMETRY_RELEASE=0.1.0
```

`TELEMETRY_ENVIRONMENT` accepts `development`, `test`, `staging`, or `production`. `TELEMETRY_RELEASE` is an operator-supplied version or commit identifier, at most 80 letters, digits, dots, underscores or hyphens, starting with a letter or digit. Do not put customer data or credentials in deployment tags. Missing or invalid configuration disables delivery without failing service startup. This change does not activate production reporting.

The adapter sends to `https://eu.i.posthog.com/i/v0/e/` with the same public write-only project token selected in `clients/landing-page/src/services/analytics.ts`. It needs no personal PostHog API key. The production server has no endpoint override. Adapter tests supply an owned loopback receiver. See [PostHog's capture API](https://posthog.com/tutorials/api-capture-events) for the event envelope.

## Diagnostic fields

Every event has only these properties:

| Field | Meaning |
| --- | --- |
| `service` | `manager` or `relay`; keep these separate when investigating failures. |
| `environment` | Deployment stage, not an account's environment identity. |
| `release` | Operator-supplied build version or commit. |
| `failure` | A fixed code from the adapter's allowlist. |
| `distinct_id` | `service:<service>:<environment>`; no person, device, account, or workbench identity. |
| `$process_person_profile` | `false`; do not create person profiles. |
| `$exception_list` | Present only for unexpected request exceptions. Contains a synthetic `ServiceFailure`, the fixed failure code and a handled/synthetic mechanism. No original exception data. |

Unexpected request exceptions use `$exception`. Selected operational failures use `service_operation_failed`:

- Manager: `renewal_database_failed`, `renewal_signing_failed`, `renewal_service_failed`.
- Relay: `sync_initialize_failed`, `sync_snapshot_failed`, `sync_replay_failed`, `sync_submit_failed`, `sync_recover_failed`, `sync_subscription_failed`, `asset_operation_failed`.

The adapter accepts only a failure code. Never pass an Error, message, stack, cause, request, URL, header, record, file path, asset bytes, bearer token, grant, or private key. Runtime inputs outside the allowlist are discarded. Expected authentication denials, malformed requests and normal cancellation are not request exceptions. A failed relay data operation can include a rejected publication or unavailable scope; operational counts alone do not establish an infrastructure outage.

## Delivery and shutdown

Reporting returns immediately. Each process admits at most eight deliveries at once. It drops further events while full, discards response bodies, rejects redirects, and aborts each attempt after two seconds. There is no disk queue or retry. Network failure and denied delivery are swallowed. Shutdown aborts outstanding deliveries without waiting for telemetry. Recent events can be lost when a process stops.

The adapter adds no process-wide exception handlers and does not change synchronization, authentication expiry, storage ownership or backup state. The handler boundaries return a generic 503 for unexpected exceptions. Existing validation and operational responses remain in place. Manager renewal categories remain in provider logs. Infrastructure details, database health, resource use and provider outages belong in provider logs and metrics, not in this destination.

## Incremental usage and cost

Each admitted failure produces at most one capture request. There are no success events, periodic events, person profiles, recordings or automatic exception hooks. Compare PostHog event counts by `service`, `environment`, `release` and event name with the preceding period. Account for exception events separately from operational events using the project's current billing rates; keep browser analytics usage separate. Admission limits bound concurrent work, not total events over time.

At shutdown each service logs a `telemetry.delivery` summary with `attempted`, `sent`, `failed`, and `dropped` counters. `sent` means the HTTP endpoint accepted the request, not confirmed downstream ingestion. In-flight deliveries may not have settled when this final summary is written. Disabled delivery also counts as dropped. Use these process-local counters and provider request/egress metrics to explain differences in captured volume. They are not durable accounting records.

## Validation and remaining owners

Use synthetic fixtures only:

```sh
bun run --cwd services/telemetry test
bun run --cwd services/account-manager test:integration src/renewal-failures.p1.integration.ts src/manager-http.p1.integration.ts
cd packages/pstdio-sync-contracts
bun scripts/isolated.ts ../../services/relay/src/transport/telemetry.p1.integration.ts
```

The tests capture exact redacted envelopes at owned HTTP receivers, deny delivery, and exercise real PostgreSQL manager and relay call sites while health checks and valid snapshot reads remain available. The manager image smoke runs the bundled adapter tests. The relay image smoke verifies the production relay with its bundled dependencies.

Manager owner-management and relay authorization catches currently flatten internal failures into ordinary access denial. They are outside the selected reporting call sites: sending every denial as an exception would misclassify expected behavior. Separating those errors needs owner-side failure categories and dedicated outage tests before adding diagnostics there.

There is no production backup scheduler/runner in this tree. Storage snapshot/restore methods are content owners, not a backup job. Add fixed operational codes at the backup owner's failure boundary when that owner exists, and exercise backup success with delivery denied there. Do not create a backup runner or report content to satisfy a diagnostic call site. Uncaught process failures and startup/shutdown failures remain in provider logs; there is no blocking telemetry flush.
