# Account authority development

The private account manager owns durable account and environment authority separately from synchronized workbench content.

## Boundary

`infra/account-manager/` is a private Bun workspace. `createAccountManager(databaseUrl)` receives a separate manager PostgreSQL connection from the trusted manager process. Run `migrateAccountManager(databaseUrl, migrationsFolder)` with its generated migrations before opening authority operations. The manager and relay use separate databases and roles on the shared PostgreSQL server.

This is an internal data owner. It starts no listener and does not verify Google ID tokens or authenticate public callers. The future Google/session service must verify sign-in and current ownership before invoking these methods. Never expose lifecycle or issuance methods directly to untrusted bodies, and never send the manager connection to extensions or local execution contexts. Supplying a Google subject or account ID is not proof of permission.

The component implements part of PS-735. Google sign-in, public manager endpoints, relay transport, active subscription closure, deployed role configuration, backups and production recovery remain later work. See [ADR 0076](../../adrs/0076-separate-account-authority-from-content.md).

## Internal operations

| Method | Behavior |
| --- | --- |
| `provision(intent)` | Create a stable account with its current canonical Google issuer/subject owner. Reprovisioning cannot silently replace that owner or activate a disabled account. |
| `register(intent)` | Register an account/environment/workbench grant with an explicit finite `expiresAt`. Return a new credential once, or the same safe metadata and `token: null` on an exact retry. |
| `replace(intent)` | Issue a new grant while atomically revoking the named `replacesId` in the same scope. A competing stale replacement fails. |
| `authorize(token, workbenchId)` | Read current account/grant state and database time. Return trusted account/workbench/environment identity or `null`. |
| `environments(accountId)` | Return grant metadata for the account, including expiry and revocation, without credential material. The authenticated caller owns permission to inspect the account. |
| `revoke(intent)` | Revoke that account/environment's grants across its workbenches. Another account with overlapping IDs is unaffected. |
| `disable(intent)` | Disable account authorization and new issuance. Retried historical issuance returns metadata, not new authority. |
| `reconcile(intent)` | Apply explicit current operator ownership/lifecycle and revoke all existing account grants. This is the private recovery boundary, not a user-facing ownership-transfer API. |
| `snapshot()` | Capture a consistent, versioned private manager snapshot. It excludes credential rows and digests. |
| `restore(requestId, snapshot)` | Import missing history, preserve known identities and receipts, remove every credential and disable all accounts atomically. An exact completed retry preserves authority established afterward; changed input cannot reuse its ID. |
| `close()` | Close this owner's PostgreSQL connections. |

Every mutating account intent has a stable `requestId` and `accountId`. Keep the original parsed input for retries. The mutation and its safe result commit together. The same request ID cannot name another action or changed input within that account. Requests are independent across accounts. No plaintext credential is stored in a row, request result or snapshot.

A lost issuance response does not make plaintext recoverable. Read the same request's metadata and submit a fresh authenticated replacement naming its credential ID. Do not create a second plaintext copy or silently reuse an uncertain secret. The data owner defines no hidden credential lifetime or product quota; the trusted issuance intent supplies expiry under the later service's policy.

Future relay handlers must use the identity returned by `authorize`, then validate their published extension context. A successful check does not authorize a connection forever. Current operation checks and revocation delivery to active subscriptions belong to the later transport integration.

## Recovery

Keep manager and content recovery separate. Restoring content must not call manager restore. Preserve current manager state when it survives recovery.

An owned manager restore uses a new immutable operator request ID. It first validates snapshot account/workbench relationships and receipt result ownership. It rejects a snapshot receipt whose fingerprint or result conflicts with a known request. Its transaction imports missing account/workbench identities and receipts, retains all known history and current owner metadata, removes every credential and disables every known or imported account. Historical identities are not permission. Even an account created after the snapshot stays disabled, and replaying its completed provision or registration cannot create new authority.

The operator then establishes current ownership/lifecycle with a new reconciliation intent. The later authenticated service requires fresh Google sign-in and environment registration. Owned restore preserves known completion history; it does not recover unknown history absent from an external backup.

Restore receipts live outside account snapshots. Existence records committed completion, so a retry after a lost response cannot disable fresh registrations. Another intentional restore needs another request ID. Shared/exclusive PostgreSQL transaction locks serialize restore and authority mutations; snapshot reads use repeatable-read isolation.

Restore inserts account, workbench and receipt history in bounded SQL batches inside that same transaction. Snapshot size does not change the atomic recovery boundary. Credential lookups and updates use the account/environment index rather than scanning every account's grants.

This snapshot is private operator data. It contains account identities and request metadata even though it excludes credential material. It is not encrypted backup tooling or a public content export. Future manager session credentials must also participate in recovery invalidation.

## Validate in Docker

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd infra/account-manager test:isolated
bun run --cwd infra/account-manager lint
bun run --cwd infra/account-manager build
```

The isolated command starts its own PostgreSQL container, creates distinct manager and relay roles/databases, runs the real-store tests, then builds and runs `Dockerfile.smoke`. That smoke imports the actual bundled `authority.js` and uses the copied generated migrations without a developer checkout or dependency install in its runtime image. It checks restart, duplicate issuance, revocation, restore invalidation and restore retry.

The Linux isolated infrastructure CI job runs the source suite and built image explicitly, alongside the relay checks. Manager changes select that job. Cross-platform package checks still build and lint this private owner; it has no ordinary `test` target that would launch Linux containers from Windows. Existing allowances and workloads remain unchanged. For a focused source file, append its path to `test:isolated`, such as `src/recovery.test.ts`; the built smoke still follows a passing source run.

Each run prints `manager-authority-<uuid>`. Its PostgreSQL data, containers and internal network belong to that run and are removed in cleanup. It publishes no host ports and mounts source read-only only in the source tester. The built smoke has no source mount. Fixture credentials are test-only. The developer application's database and unrelated Docker projects are never opened or changed.

The default fixture subnet is `10.254.234.0/24`. Run these fixtures sequentially, or set `MANAGER_TEST_SUBNET` to a separately inspected unused subnet. Role-denial success proves this fixture's permissions; live hosting must configure and validate its own manager/relay separation.
