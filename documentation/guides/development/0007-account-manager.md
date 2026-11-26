# Account authority development

The private account manager owns durable account and device authority separately from synchronized project content.

## Boundary

`services/account-manager/` is a private Bun workspace. `createAccountManager(databaseUrl)` receives a separate manager PostgreSQL connection from the trusted manager process. Run `migrateAccountManager(databaseUrl, migrationsFolder)` with its generated migrations before opening authority operations. The manager and relay use separate databases and roles on the shared PostgreSQL server.

The data owner's lifecycle methods remain internal. `createManagerAuthentication(config)` embeds Better Auth 1.7.10 for Google and Microsoft sign-in, persisted human sessions and signing keys. `createManagerHandler(auth, origin)` serves auth, device login and device management. Never expose private lifecycle methods directly to untrusted bodies or send the manager connection to extensions or native clients. A supplied provider subject or account ID is not permission.

The component implements part of PS-735. The relay verifies the manager's signed access tokens: `bun run --cwd services/relay test:integration` runs the relay against the actual manager with fixture keys and an owned HTTPS fixture. Live Google configuration, deployed role/network isolation, backups and production recovery remain separate proof. See [ADR 0124](../../adrs/0124-separate-account-authority-from-content.md).

## Devices and cloud projects

A device is one client runtime. Its environment ID is its device ID. Logging in on a client registers it as a device of the user's account and gives it one device credential. That credential renews access to every cloud project of the account. There is no step per project ([0014 · RB 9.A.1](../../requirement-book/book.json), R34, R35, R37).

- `manager_devices` holds each device: account, ID, name, platform, created, last seen, removed, and the SHA-256 digest of its current credential. The plaintext credential is never stored.
- Logging in again on the same device replaces its credential and undoes an earlier removal. The device keeps its name.
- `manager_workbenches` lists the account's cloud projects. A device renews access only for those.
- Removing a device stops its renewal. Removing a cloud project stops renewal for it on every device. Access already issued stays valid until it expires.
- `manager_space_keys` holds the encryption keys of each cloud project: a project key and the key for the owner's private project data, one row per generation. The first key request for a cloud project creates generation 1. Removing a device adds the next generation of every key of the account, so the removed device cannot read data written afterward. Older generations stay. See [ADR 0085](../../adrs/0085-encrypt-sync-data-with-account-manager-keys.md).
- Every renewal updates the device's last-seen time.

Renewal prepares its signed token before opening the account transaction. Signing reads persisted keys through the connection pool, so holding an account transaction during signing can deadlock when waiting requests occupy the other connections. Before delivering the prepared token, renewal rechecks the current credential, account state, device, project membership and relay grant under the account lock. Its scope must still match the prepared claims, and the presence update must commit. A removal or credential replacement that commits during signing denies delivery. An expired preparation fails rather than returning expired access. Clients may retry that service failure normally.

## Cloud early access

Signing in and managing devices work for every active account. Cloud projects, encryption keys and new relay access require the account's `relay` feature. `manager_account_features` stores one row per account and feature, with `grantedAt`. There is no grant by default, including for existing accounts after migration. Plans and billing are separate future work.

An operator grants or revokes early access by the verified Google email after the person signs in once. Run these commands with the manager's private `DATABASE_URL` already set in the operator environment:

```sh
bun run --cwd services/account-manager account-feature grant --email person@example.com --feature relay
bun run --cwd services/account-manager account-feature revoke --email person@example.com --feature relay
```

For Microsoft accounts, pass the stable ID to `--account`. Read `login.accountId` from the signed-in host’s `GET /v1/account` response or use the private manager inventory. Microsoft email claims are optional and can change. [Feature grant example](0011-device-login.md#login-flow)

The production manager image includes the same command at `bun dist/account-feature.js`. An unknown, unverified or ambiguous email fails without creating an account. The command follows the stored Google subject to the product account; email itself is not the account identity. Repeating a grant keeps its original timestamp. Repeating a revoke succeeds.

Without the feature, `GET /v1/workbenches` returns an empty list, adding a cloud project returns 403, key requests return 404 and access renewal returns 401. Revoking keeps project membership and keys so a later grant resumes access. It does not remove devices. Tokens already issued remain valid until their existing expiry. The relay continues to verify only the manager's tokens and never reads feature grants.

`GET /v1/account` with a device credential returns `{ features: { relay: boolean } }`. The host refreshes this with project discovery. Its account status exposes the last loaded grants, or `null` before discovery or when signed out. The manager checks the current grant for every new Cloud request; cached host status is never authorization.

## Internal operations

| Method | Behavior |
| --- | --- |
| `provision(intent)` | Create a stable account with its current canonical issuer/subject owner. Reprovisioning cannot silently replace that owner or activate a disabled account. |
| `registerDevice(input)` | Register or log in again a device of an active account. Returns `{ accountId, deviceId, token }`. The token is returned only here. |
| `removeDevice(input)` | Remove a device. Its credential stops renewing access, and every key of the account gets a new generation. |
| `addWorkbench(input)` / `removeWorkbench(input)` | Make a project a cloud project of the account, or stop syncing it. Removing keeps the project's keys. |
| `devices(accountId)` / `workbenches(accountId)` | List the account's active devices or cloud projects, without credential material. |
| `authorize(token, workbenchId)` | Read current account, device and cloud project state. Return `{ accountId, workbenchId, deviceId }` or `null`. |
| `setFeature({ accountId, feature, enabled })` | Private operator/fixture operation. Grant or revoke a feature under the same account lock used by renewal. Never expose it as a client API. |
| `disable(intent)` | Disable account authorization and new logins. |
| `reconcile(intent)` | Apply explicit current operator ownership/lifecycle and remove every device of the account, which adds a new key generation. This is the private recovery boundary, not a user-facing ownership-transfer API. |
| `snapshot()` | Capture a consistent, versioned private manager snapshot (version 3). It includes encryption keys and excludes devices and credential digests. |
| `restore(requestId, snapshot)` | Import missing history, preserve known identities and receipts, remove every device and disable all accounts atomically. An exact completed retry preserves authority established afterward; changed input cannot reuse its ID. |
| `close()` | Close this owner's PostgreSQL connections. |

`provision`, `disable` and `reconcile` carry a stable `requestId` and `accountId`. The mutation and its safe result commit together. The same request ID cannot name another action or changed input within that account. Device and cloud project changes need no request ID because repeating them has the same result. A lost login response leaves no usable secret; the client logs in again, which replaces the credential.

The manager uses current product authority for renewal. Ordinary relay requests instead use finite signed access through the database-free `pstdio-account-manager/access` export. They validate signature, issuer/audience, product type, expiry and exact scope. The token's `environmentId` claim is the device ID. Removal denies renewal; issued access remains usable until its expiry. Subscriptions must close or validly renew by then. No manager-per-request/hint call or idle revocation polling is required.

## Better Auth and HTTP

Better Auth owns `/api/auth/*`, including Google and Microsoft sign-in/callback, sessions, sign-out and public JWKS. The generic human `/token` route is disabled. Product access comes only from current device renewal authority. Account linking is disabled, so matching email cannot transfer provider identity. Device login maps the verified issuer and subject to its account. Microsoft uses its tenant-specific v2 issuer and application-scoped `sub`. Its internal Better Auth email value is scoped to that identity, so Google and Microsoft may hold separate accounts even if they report the same email.

| Route | Caller and result |
| --- | --- |
| GET /v1/native-login, /v1/native-callback | Browser. Starts the selected provider’s sign-in (Google by default) and returns a single-use code to the native loopback callback. |
| POST /v1/device-login | Provider session and the manager's exact Origin. Body `{ deviceId, name, platform, provider? }`. If supplied, `provider` must match the session. Finds or creates the user's account, registers the device, and returns its credential and the relay origin. |
| POST /v1/environment-access | Device credential plus JSON workbenchId; returns finite token and expiresAt. |
| GET /v1/account | Device credential. Returns the account's feature grants. |
| GET /v1/devices | Device credential. Returns this device's account and device IDs and the account's devices. |
| POST /v1/devices/:id/rename, /v1/devices/:id/remove | Device credential. Rename or remove a device of the same account. |
| GET /v1/workbenches | Device credential. Lists the account's cloud projects. |
| POST /v1/workbenches/:id, /v1/workbenches/:id/remove | Device credential. Make a project a cloud project, or stop syncing it. |
| GET /v1/workbenches/:id/keys | Device credential. Returns `{ project, personal }`, each a list of `{ generation, secret }` from oldest to newest, and creates generation 1 on the first request. 404 when the account has no such cloud project. |

The provider session is needed only to log in. Login uses the account that provider identity already owns. New accounts derive their ID from the verified issuer and subject. Continue using the same provider and, for Microsoft, the same account and application registration to return to that account. Devices of one account manage each other. A device can never see or change the devices or cloud projects of another account. Operator lifecycle and recovery remain private. See [device login development](0011-device-login.md) for the supported browser and CLI flow. Errors discard sensitive causes and responses use no-store.

The Bun listener requires DATABASE_URL, MANAGER_ORIGIN, RELAY_AUDIENCE, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_LIFETIME_SECONDS, SESSION_UPDATE_AGE_SECONDS and ACCESS_LIFETIME_SECONDS. Lifetimes are positive explicit policy, with update age below session lifetime. Origins use HTTPS. MANAGER_HOST/PORT select the listener; optional paired MANAGER_TLS_CERT/KEY paths supply TLS when it terminates in this process. A trusted HTTPS ingress can terminate TLS instead. Configure Google's callback as MANAGER_ORIGIN followed by /api/auth/callback/google.

### Microsoft Web application registration

1. In Microsoft Entra **App registrations**, register a Web app for **Accounts in any organizational directory and personal Microsoft accounts**. Prompt Studio uses the public Microsoft cloud with the v2 `common` authority. Organization consent and Conditional Access policies still apply. [Microsoft OpenID Connect](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
2. Under **Authentication**, register the Web redirect URI `<MANAGER_ORIGIN>/api/auth/callback/microsoft`. Include the full HTTPS service path, for example `https://base.prompt.studio/accounts/api/auth/callback/microsoft`. Add a separate exact callback for any staging manager you intend to use. Keep the platform type Web and use standard Microsoft signing keys. App-specific claims-mapping signing keys are outside this registration.
3. Set `MICROSOFT_CLIENT_ID` to the public Application (client) ID and put the client secret **value** in the account-manager secret store as `MICROSOFT_CLIENT_SECRET`. Configure both or leave both unset. The manager requests only `openid profile`; it needs neither Microsoft Graph permissions nor implicit flow. Device and relay renewal use Prompt Studio credentials.
4. Deploy the updated manager before the Cloud UI and check both the existing Google path and Microsoft consent from a personal account and a work or school account using Cloud settings. Record the manager origin, callback, app client ID, account class and outcome. Keep secret values, tokens, and sign-in URLs out of evidence.

The Application (client) ID forms part of the Microsoft subject’s stability. Rotate the secret on the existing registration to preserve ownership.

## Addresses with a path

MANAGER_ORIGIN and RELAY_AUDIENCE are HTTPS addresses and may include a path, so both services can share one host, for example `https://base.prompt.studio/accounts` and `https://base.prompt.studio/relay`. The proxy in front of each service removes that path before forwarding, so the services keep serving at `/`. The manager uses its full address for the provider callbacks, the native sign-in callback and the token issuer, and adds its path back before Better Auth handles a request. Browser `Origin` checks still compare the origin without the path. Clients join every request path under the address they were given.

Build the production image with `docker build -f infra/account-manager/Dockerfile .`. Apply generated migrations through operator tooling first. The slim runtime needs no source mount or dependency install. Never put secrets in command arguments, URLs or logs.

The independent verifier receives only issuer, audience and a public JWKS. It imports no manager database or signing configuration. Keep public keys available for all unexpired access they cover. The library persists signing material outside content; deploying or rotating trust is an operator responsibility. See [Google configuration](https://better-auth.com/docs/authentication/google), [JWT/session separation](https://better-auth.com/docs/plugins/jwt) and [Drizzle integration](https://better-auth.com/docs/adapters/drizzle).

## Recovery

Keep manager and content recovery separate. Restoring content must not call manager restore. Preserve current manager state when it survives recovery.

An owned manager restore uses a new immutable operator request ID. It first validates snapshot account/workbench relationships and receipt result ownership. It rejects a snapshot receipt whose fingerprint or result conflicts with a known request, and a snapshot key whose secret differs from a stored key. Its transaction imports missing account/workbench identities, encryption keys and receipts, retains all known history and current owner metadata, removes every device and disables every known or imported account. Historical identities are not permission. Even an account created after the snapshot stays disabled, and replaying its completed provision cannot create new authority.

The operator then establishes current ownership/lifecycle with a new reconciliation intent. Every device then signs in again with its original provider. Owned restore preserves known completion history; it does not recover unknown history absent from an external backup.

Feature grants are current operator access policy and are excluded from historical snapshots, like device credentials. A restore preserves surviving feature rows; restoring into an empty database grants no features. After recovery, the operator checks current early access and grants it again when needed. Full database backups include the feature table.

Restore receipts live outside account snapshots. Existence records committed completion, so a retry after a lost response cannot disable fresh registrations. Another intentional restore needs another request ID. Shared/exclusive PostgreSQL transaction locks serialize restore and authority mutations; snapshot reads use repeatable-read isolation.

Restore inserts account, workbench, key and receipt history in bounded SQL batches inside that same transaction. Snapshot size does not change the atomic recovery boundary. Credential lookups use the unique digest index on `manager_devices`.

This snapshot is private operator data. It contains account identities, request metadata and every encryption key, so losing the manager database never makes relay data unreadable (R14). Store it apart from relay backups: together they can read project data. It excludes credentials and library signing keys, and is not encrypted backup tooling or a public content export. Owned restore deletes library sessions and pending verifications, preserves provider identity/signing material and denies fresh renewal until reconciliation. Already issued access retains its expiry; preserve public verification trust accordingly. A complete stale database/key backup recovery remains a separate validation gate.

## Validate in Docker

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd services/account-manager test:integration
bun run --cwd services/account-manager lint
bun run --cwd services/account-manager build
```

The isolated command starts its own PostgreSQL container, creates distinct manager and relay roles/databases, runs real-store tests, then builds and runs `Dockerfile.smoke`. It checks stable provider mapping with actual Better Auth verification against an owned HTTP key fixture, sessions/logout, device login, renewal/removal/expiry, scope, recovery and the original authority workload. The Google fixture routes only public-key transport to an owned server; it is not live Google evidence.

The smoke imports the actual bundled authority, starts the actual bundled HTTPS manager with run-owned TLS, and runs a separately bundled verifier with an empty environment. No manager DB or secret enters that verifier. Issuance, denied renewal after device removal, retained unexpired access during manager outage and clean shutdown are proved without source mounts or runtime installs. Only the smoke image includes OpenSSL for fresh fixture certificates; the production image stays slim.

The Linux isolated infrastructure CI job runs the source suite and built image explicitly, alongside the relay checks. Manager changes select that job. Cross-platform package checks still build and lint this private owner; it has no ordinary `test` target that would launch Linux containers from Windows. Existing allowances and workloads remain unchanged. For a focused source file, append its path to `test:integration`, such as `src/recovery.p1.integration.ts`; the built smoke still follows a passing source run.

Each run prints `manager-authority-<uuid>`. Its PostgreSQL data, containers and internal network belong to that run and are removed in cleanup. It publishes no host ports and mounts source read-only only in the source tester. The built smoke has no source mount. Fixture credentials are test-only. The developer application's database and unrelated Docker projects are never opened or changed.

Docker allocates the fixture network automatically. `MANAGER_TEST_SUBNET` remains an explicit diagnostic override; local review clears inherited overrides. Role-denial success proves this fixture's permissions; live hosting must configure and validate its own manager/relay separation.

## Team accounts

A personal account ID remains the stable user ID for existing devices and private spaces. Team accounts have a separate ID and explicit team and project grants. The relay token carries the owning account ID and the signed-in user ID. The relay routes shared data by account and project, and checks private spaces by user.

A team starts with early access disabled. Grant or revoke Cloud relay access for a specific team with `account-feature grant --account-id <team-account-id> --feature relay` or the matching `revoke` command. Email lookup continues to target a verified personal account.

Snapshots keep team ownership, project grants and key history. Restoring an existing team preserves its current membership. Restored accounts remain disabled until operator reconciliation. For a team, reconcile its state without supplying a Google owner.

## Team invitations and member authority

A Google invitation matches the verified email associated with the signed-in Google subject. A Microsoft invitation matches the Entra tenant and user object IDs from a verified Microsoft ID token. The manager stores a digest of each invitation secret. Microsoft sign-in still uses issuer and subject as the stable Prompt Studio account identity. The link carries the secret in the URL fragment. The landing page exchanges it in same-origin POST bodies after sign-in. Team membership operations take the team account lock, the same lock used before issuing scoped renewal and keys.

Snapshots capture the current team members. Invitation links are excluded from backups, and a restore cancels outstanding invitations on the surviving manager. A historical snapshot leaves the current roster on surviving teams intact.

The manager records the latest verified address from the Google sign-in claim separately from the cached auth profile. Older claims cannot overwrite it. People with older sessions may need to sign in again before accepting an invitation. Removing a member closes earlier invitations for that person, including links issued to a former address.

### Desktop invitation codes

The owner can create a code with `POST /v1/teams/:teamId/invite-codes` and an empty JSON object. The response contains its ID, secret code and expiry. The secret is returned once; `GET` on the same route lists only IDs and expiries. Codes contain 256 random bits, expire after 24 hours and store only their SHA-256 digest. Cancel a code through the existing invitation cancellation route. Targeted Google and Microsoft invitations retain their recipient checks and seven-day lifetime.

A code can be transferred to any signed-in person. Inspect and accept it through the existing invitation endpoints, putting the code in the JSON `secret` field. Acceptance consumes it under the team lock. A retry by its successful recipient returns the same team; a different recipient cannot reuse it. Joining grants team membership only, with project access assigned separately. Removing a member cancels all outstanding desktop codes, so a code they held cannot admit a fresh identity. Ask the owner for a new code if another pending invitation is affected. Restore also cancels outstanding codes.

Deploy the manager and its generated migration before exposing code creation in native clients. Rehearse against a disposable database first, retaining a recovery point and the current image digest. Before rolling back to a manager image that predates codes, stop candidate instances from issuing or accepting invitations, cancel every pending untargeted code, and verify none remain pending. Use the candidate owner's code-list and cancellation APIs for every team, or an approved operator database procedure. Older targeted-invitation readers cannot interpret a live code row; expired rows may also become active if a clock changes, so cancel pending codes regardless of expiry. Keep the additive schema migration applied during an image-only rollback: existing targeted rows remain valid, and accepted-code history still prevents replay. Re-enable issuance only after a code-capable manager is running again. An image predating Microsoft invitation support also needs the separate Microsoft-compatible rollback and recovery checks in the [hosted acceptance guide](0023-microsoft-team-cloud-acceptance.md).

## Team project grant removal

The manager grants team project membership explicitly, including owner content access. Revoke changes are serialized under the owning account lock with key reads and the final renewal check. Removing a member or accepting their request to leave revokes their grants and rotates each affected shared generation in that transaction. Project deletion remains a separate owner action. Restore retains current team authority and the newer generation history.

An already issued relay token stays valid until its configured expiry. Team sync sends writes using the lease of its existing shared live connection. Expiry aborts jobs using the old key snapshot and reconnecting fetches current keys before posting. This cutoff leaves downloads and previously issued generations on their devices. Removing a device rotates its user's private keys, reachable shared keys, and previously issued keys for paused projects.

Each active team project grant has its own identity. Team devices include that identity when asking for renewed access or keys. The manager rechecks it under the team lock. If a device misses a revocation and later sees a new grant for the same project, it folds the older queued edits and runs the returning-device flow before reconnecting. Team members use a native build that supports grant identities. Personal access continues to use the device and project identity.

Pausing a team project ends its active grants and rotates the shared key. An owner explicitly resumes their own access when restarting sync, then grants access to the other members again. Project discovery uses a single lease and only downloads the encrypted project record. While team HTTP requests are queued or streaming, their original lease expiry also cancels request admission or transfer.

## Ownership consent and recovery

Ownership offers target an active member's stable user ID. Only the current owner issues or cancels an offer, and only its recipient can accept or decline. The manager verifies that both accounts remain active, updates both roles under the team lock and commits them together. Acceptance never rewrites project grants, devices, or keys.

Removing a recipient closes their pending offer. Restore closes outstanding offers and keeps the roles of existing teams. Snapshot recovery never reapplies an older offer or overwrites a surviving team with historical roles.
