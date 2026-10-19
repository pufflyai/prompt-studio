# Account authority development

The private account manager owns durable account and device authority separately from synchronized project content.

## Boundary

`infra/account-manager/` is a private Bun workspace. `createAccountManager(databaseUrl)` receives a separate manager PostgreSQL connection from the trusted manager process. Run `migrateAccountManager(databaseUrl, migrationsFolder)` with its generated migrations before opening authority operations. The manager and relay use separate databases and roles on the shared PostgreSQL server.

The data owner's lifecycle methods remain internal. `createManagerAuthentication(config)` embeds Better Auth 1.7.10 for Google sign-in, persisted human sessions and signing keys. `createManagerHandler(auth, origin)` serves auth, device login and device management. Never expose private lifecycle methods directly to untrusted bodies or send the manager connection to extensions or native clients. A supplied Google subject or account ID is not permission.

The component implements part of PS-735. The relay verifies the manager's signed access tokens: `bun run --cwd infra/relay test:transport` and `test:isolated` run the relay against the actual manager with fixture keys and an owned HTTPS fixture. Live Google configuration, deployed role/network isolation, backups and production recovery remain separate proof. See [ADR 0076](../../adrs/0076-separate-account-authority-from-content.md).

## Devices and cloud projects

A device is one client runtime. Its environment ID is its device ID. Logging in on a client registers it as a device of the user's account and gives it one device credential. That credential renews access to every cloud project of the account. There is no step per project ([PRD 0014](../../requirements/platform/0014-local-first-sync.md), R34, R35, R37).

- `manager_devices` holds each device: account, ID, name, platform, created, last seen, removed, and the SHA-256 digest of its current credential. The plaintext credential is never stored.
- Logging in again on the same device replaces its credential and undoes an earlier removal. The device keeps its name.
- `manager_workbenches` lists the account's cloud projects. A device renews access only for those.
- Removing a device stops its renewal. Removing a cloud project stops renewal for it on every device. Access already issued stays valid until it expires.
- Every renewal updates the device's last-seen time.

## Internal operations

| Method | Behavior |
| --- | --- |
| `provision(intent)` | Create a stable account with its current canonical Google issuer/subject owner. Reprovisioning cannot silently replace that owner or activate a disabled account. |
| `registerDevice(input)` | Register or log in again a device of an active account. Returns `{ accountId, deviceId, token }`. The token is returned only here. |
| `removeDevice(input)` | Remove a device. Its credential stops renewing access. |
| `addWorkbench(input)` / `removeWorkbench(input)` | Make a project a cloud project of the account, or stop syncing it. |
| `devices(accountId)` / `workbenches(accountId)` | List the account's active devices or cloud projects, without credential material. |
| `authorize(token, workbenchId)` | Read current account, device and cloud project state. Return `{ accountId, workbenchId, deviceId }` or `null`. |
| `disable(intent)` | Disable account authorization and new logins. |
| `reconcile(intent)` | Apply explicit current operator ownership/lifecycle and remove every device of the account. This is the private recovery boundary, not a user-facing ownership-transfer API. |
| `snapshot()` | Capture a consistent, versioned private manager snapshot. It excludes devices and credential digests. |
| `restore(requestId, snapshot)` | Import missing history, preserve known identities and receipts, remove every device and disable all accounts atomically. An exact completed retry preserves authority established afterward; changed input cannot reuse its ID. |
| `close()` | Close this owner's PostgreSQL connections. |

`provision`, `disable` and `reconcile` carry a stable `requestId` and `accountId`. The mutation and its safe result commit together. The same request ID cannot name another action or changed input within that account. Device and cloud project changes need no request ID because repeating them has the same result. A lost login response leaves no usable secret; the client logs in again, which replaces the credential.

The manager uses current product authority for renewal. Ordinary relay requests instead use finite signed access through the database-free `pstdio-account-manager/access` export. They validate signature, issuer/audience, product type, expiry and exact scope. The token's `environmentId` claim is the device ID. Removal denies renewal; issued access remains usable until its expiry. Subscriptions must close or validly renew by then. No manager-per-request/hint call or idle revocation polling is required.

## Better Auth and HTTP

Better Auth owns `/api/auth/*`, including Google sign-in/callback, sessions, sign-out and public JWKS. The generic human `/token` route is disabled. Product access comes only from current device renewal authority. Account linking is disabled, so matching email cannot transfer a Google provider identity. Device login maps the stable Google subject to its account inside the login transaction.

| Route | Caller and result |
| --- | --- |
| GET /v1/native-login, /v1/native-callback | Browser. Starts Google sign-in and returns a single-use code to the native loopback callback. |
| POST /v1/device-login | Google session and the manager's exact Origin. Body `{ deviceId, name, platform }`. Finds or creates the user's account, registers the device, and returns its credential and the relay origin. |
| POST /v1/environment-access | Device credential plus JSON workbenchId; returns finite token and expiresAt. |
| GET /v1/devices | Device credential. Returns this device's account and device IDs and the account's devices. |
| POST /v1/devices/:id/rename, /v1/devices/:id/remove | Device credential. Rename or remove a device of the same account. |
| GET /v1/workbenches | Device credential. Lists the account's cloud projects. |
| POST /v1/workbenches/:id, /v1/workbenches/:id/remove | Device credential. Make a project a cloud project, or stop syncing it. |

The Google session is needed only to log in. The account ID is derived from the Google issuer and subject, so every login of one user finds the same account. Devices of one account manage each other; a device of another account gets 401 or 404. Operator lifecycle and recovery remain private. See [device login development](0011-device-login.md) for the supported browser and CLI flow. Errors discard sensitive causes and responses use no-store.

The Bun listener requires DATABASE_URL, MANAGER_ORIGIN, RELAY_AUDIENCE, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_LIFETIME_SECONDS, SESSION_UPDATE_AGE_SECONDS and ACCESS_LIFETIME_SECONDS. Lifetimes are positive explicit policy, with update age below session lifetime. Origins use HTTPS. MANAGER_HOST/PORT select the listener; optional paired MANAGER_TLS_CERT/KEY paths supply TLS when it terminates in this process. A trusted HTTPS ingress can terminate TLS instead. Configure Google's callback for the trusted origin's /api/auth/callback/google path.

Build the production image with `docker build -f infra/account-manager/Dockerfile .`. Apply generated migrations through operator tooling first. The slim runtime needs no source mount or dependency install. Never put secrets in command arguments, URLs or logs.

The independent verifier receives only issuer, audience and a public JWKS. It imports no manager database or signing configuration. Keep public keys available for all unexpired access they cover. The library persists signing material outside content; deploying or rotating trust is an operator responsibility. See [Google configuration](https://better-auth.com/docs/authentication/google), [JWT/session separation](https://better-auth.com/docs/plugins/jwt) and [Drizzle integration](https://better-auth.com/docs/adapters/drizzle).

## Recovery

Keep manager and content recovery separate. Restoring content must not call manager restore. Preserve current manager state when it survives recovery.

An owned manager restore uses a new immutable operator request ID. It first validates snapshot account/workbench relationships and receipt result ownership. It rejects a snapshot receipt whose fingerprint or result conflicts with a known request. Its transaction imports missing account/workbench identities and receipts, retains all known history and current owner metadata, removes every device and disables every known or imported account. Historical identities are not permission. Even an account created after the snapshot stays disabled, and replaying its completed provision cannot create new authority.

The operator then establishes current ownership/lifecycle with a new reconciliation intent. Every device then logs in again with Google. Owned restore preserves known completion history; it does not recover unknown history absent from an external backup.

Restore receipts live outside account snapshots. Existence records committed completion, so a retry after a lost response cannot disable fresh registrations. Another intentional restore needs another request ID. Shared/exclusive PostgreSQL transaction locks serialize restore and authority mutations; snapshot reads use repeatable-read isolation.

Restore inserts account, workbench and receipt history in bounded SQL batches inside that same transaction. Snapshot size does not change the atomic recovery boundary. Credential lookups use the unique digest index on `manager_devices`.

This snapshot is private operator data. It contains account identities and request metadata, excludes credentials and library signing keys, and is not encrypted backup tooling or a public content export. Owned restore deletes library sessions and pending verifications, preserves provider identity/signing material and denies fresh renewal until reconciliation. Already issued access retains its expiry; preserve public verification trust accordingly. A complete stale database/key backup recovery remains a separate validation gate.

## Validate in Docker

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd infra/account-manager test:isolated
bun run --cwd infra/account-manager lint
bun run --cwd infra/account-manager build
```

The isolated command starts its own PostgreSQL container, creates distinct manager and relay roles/databases, runs real-store tests, then builds and runs `Dockerfile.smoke`. It checks stable provider mapping with actual Better Auth verification against an owned HTTP key fixture, sessions/logout, device login, renewal/removal/expiry, scope, recovery and the original authority workload. The Google fixture routes only public-key transport to an owned server; it is not live Google evidence.

The smoke imports the actual bundled authority, starts the actual bundled HTTPS manager with run-owned TLS, and runs a separately bundled verifier with an empty environment. No manager DB or secret enters that verifier. Issuance, denied renewal after device removal, retained unexpired access during manager outage and clean shutdown are proved without source mounts or runtime installs. Only the smoke image includes OpenSSL for fresh fixture certificates; the production image stays slim.

The Linux isolated infrastructure CI job runs the source suite and built image explicitly, alongside the relay checks. Manager changes select that job. Cross-platform package checks still build and lint this private owner; it has no ordinary `test` target that would launch Linux containers from Windows. Existing allowances and workloads remain unchanged. For a focused source file, append its path to `test:isolated`, such as `src/recovery.test.ts`; the built smoke still follows a passing source run.

Each run prints `manager-authority-<uuid>`. Its PostgreSQL data, containers and internal network belong to that run and are removed in cleanup. It publishes no host ports and mounts source read-only only in the source tester. The built smoke has no source mount. Fixture credentials are test-only. The developer application's database and unrelated Docker projects are never opened or changed.

The default fixture subnet is `10.254.234.0/24`. Run these fixtures sequentially, or set `MANAGER_TEST_SUBNET` to a separately inspected unused subnet. Role-denial success proves this fixture's permissions; live hosting must configure and validate its own manager/relay separation.
