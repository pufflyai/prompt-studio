# Account authority development

The private account manager owns durable account and environment authority separately from synchronized workbench content.

## Boundary

`infra/account-manager/` is a private Bun workspace. `createAccountManager(databaseUrl)` receives a separate manager PostgreSQL connection from the trusted manager process. Run `migrateAccountManager(databaseUrl, migrationsFolder)` with its generated migrations before opening authority operations. The manager and relay use separate databases and roles on the shared PostgreSQL server.

The account authority factory starts no listener and does not authenticate public callers. The separate Google verifier below checks ID tokens; the future login/session service must also check current ownership before invoking authority methods. Never expose lifecycle or issuance methods directly to untrusted bodies, and never send the manager connection to extensions or local execution contexts. Supplying a Google subject or account ID is not proof of permission.

The component implements part of PS-735. Browser sign-in, public manager endpoints, relay transport, active subscription closure, deployed role configuration, backups and production recovery remain later work. See [ADR 0076](../../adrs/0076-separate-account-authority-from-content.md).

## Google identity verification

Construct `createGoogleIdentityVerifier(clientId)` inside the trusted manager. Call its returned function with the Google ID token and the nonce stored for the pending login. It verifies an RS256 signature using Google's fixed public key endpoint, accepted Google issuer, configured audience, optional authorized presenter, required subject/time claims, expiry and nonce. Untrusted extra audiences fail. Successful verification returns only the canonical Google issuer and stable subject; email/profile fields do not define identity. See [Google's validation guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) and [OpenID token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).

The optional second constructor argument is a trusted fetch transport for the fixed key request, such as a proxy. Token headers cannot select a key URL, transport or algorithm. JOSE owns the public key cache and refresh behavior; its defaults remain unchanged. A warm cache can verify already fetched overlapping signing keys without another request. Unknown keys and failed cold retrieval cannot authenticate. Verification failures return a generic error without the original error/cause, which can contain rejected claims. No token or profile is stored or logged.

This verifier is stateless. The private login methods below own challenge/session persistence. The later browser handler must complete code exchange, verify identity against the stored nonce and compose the current account check. Never read the expected nonce from an untrusted callback body. Verification alone grants no account/environment permission and does not provision an account. Live OAuth client/secret/redirect setup remains required for browser sign-in.

## One-time login and owner sessions

The trusted manager begins login with an explicit finite challenge expiry. `beginLogin` returns a new state, nonce and browser-binding secret. Persist only state/binding digests and the nonce. The future browser handler must protect the binding secret in the initiating browser and send state/nonce through the Google flow. `loginChallenge(state, binding)` returns the stored nonce only while that challenge is pending and unexpired.

After code exchange and Google verification against that nonce, call `completeLogin` with state/binding, the existing account, canonical verified owner and an explicit session expiry from trusted server policy. The private store rechecks current account ownership/lifecycle, consumes the pending challenge and creates a session in one transaction. Its account lock is shared with lifecycle mutations. Independent completions have one winner. A lost successful response requires a fresh login; replay cannot issue a second credential or recover plaintext.

Only a session digest, account reference and expiry persist. `authorizeSession(token)` checks current active account state and database time, returning account identity or `null`. `logout(token)` removes that session idempotently. Disable and reconciliation remove that account's sessions; another account is unaffected. Beginning a new challenge removes expired challenges/sessions. No product lifetime default, quota, copied owner/active state or new scheduler is introduced.

These are private data-owner methods. Never pass raw callback claims as the verified owner or take expiries from an untrusted body. The later HTTP handler owns secure cookies, CSRF transport, signup/account selection and public route permissions. Session persistence does not itself complete browser login.

## Owner environment management

Use `manager.forOwnerSession(token)` for the later owner's environment operations. Its `register`, `replace`, `revoke` and `environments` methods check the live session on every call. Creating this object does not retain permission after logout, expiry, lifecycle invalidation or restore. The inputs omit account identity and reject extra account/owner claims. The store derives scope from the session, acquires the account lock and rechecks current session authority inside the shared restore boundary before reading a saved result or changing grants.

Registration takes request/workbench/environment identity and explicit trusted expiry. Replacement also names `replacesId`; revocation takes request/environment identity and affects that account across workbenches. Listing takes no account argument and returns only safe grant metadata. These operations reuse the operator path's grant and immutable request logic. A new valid owner session can retry the same domain intent, returning metadata with `token: null`; the session bearer is never part of the receipt fingerprint or result. A logged-out or expired session cannot recover even a historical result.

The later trusted handler must supply expiry policy and protect the session transport. Do not implement owner management by calling `authorizeSession` and then a privileged account method: an intervening ownership change would leave the earlier permission stale. Already authorized operations may finish; subsequent calls must pass the current check. This API does not grant owner access to account provisioning, disable/reconciliation or snapshot restore. The existing direct account methods remain privileged operator interfaces. HTTP permissions/cookies/CSRF and active relay subscription closure remain separate work.

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
| `beginLogin({ expiresAt })` | Generate a browser-bound pending login challenge with an explicit trusted expiry. |
| `loginChallenge(state, binding)` | Read the expected nonce from a live matching pending challenge, or return `null`. |
| `completeLogin(intent)` | Consume a challenge once and create a session for the current active matching account owner. The caller supplies verified identity and trusted expiry. |
| `authorizeSession(token)` | Return current account identity for a live owner session, or `null`. |
| `logout(token)` | Remove that owner session idempotently. |
| `forOwnerSession(token)` | Return session-scoped environment operations; recheck current authority inside each operation and derive its account. |
| `snapshot()` | Capture a consistent, versioned private manager snapshot. It excludes credential rows and digests. |
| `restore(requestId, snapshot)` | Import missing history, preserve known identities and receipts, remove every credential and disable all accounts atomically. An exact completed retry preserves authority established afterward; changed input cannot reuse its ID. |
| `close()` | Close this owner's PostgreSQL connections. |

Every mutating account intent has a stable `requestId` and `accountId`. Keep the original parsed input for retries. The mutation and its safe result commit together. The same request ID cannot name another action or changed input within that account. Requests are independent across accounts. No plaintext credential is stored in a row, request result or snapshot.

A lost issuance response does not make plaintext recoverable. Read the same request's metadata and submit a fresh authenticated replacement naming its credential ID. Do not create a second plaintext copy or silently reuse an uncertain secret. The data owner defines no hidden credential lifetime or product quota; the trusted issuance intent supplies expiry under the later service's policy.

Future relay handlers must use the identity returned by `authorize`, then validate their published extension context. A successful check does not authorize a connection forever. Current operation checks and revocation delivery to active subscriptions belong to the later transport integration.

## Recovery

Keep manager and content recovery separate. Restoring content must not call manager restore. Preserve current manager state when it survives recovery.

An owned manager restore uses a new immutable operator request ID. It first validates snapshot account/workbench relationships and receipt result ownership. It rejects a snapshot receipt whose fingerprint or result conflicts with a known request. Its transaction imports missing account/workbench identities and receipts, retains all known history and current owner metadata, removes every credential and disables every known or imported account. Historical identities are not permission. Even an account created after the snapshot stays disabled, and replaying its completed provision or registration cannot create new authority.

Pending challenges and owner sessions are excluded from snapshots. Restore removes all of them in the same transaction as environment credentials. The operator then establishes current ownership/lifecycle with a new reconciliation intent. A fresh Google challenge/session and environment registration are required. Owned restore preserves known completion history; it does not recover unknown history absent from an external backup.

Restore receipts live outside account snapshots. Existence records committed completion, so a retry after a lost response cannot disable fresh registrations. Another intentional restore needs another request ID. Shared/exclusive PostgreSQL transaction locks serialize restore and authority mutations; snapshot reads use repeatable-read isolation.

This snapshot is private operator data. It contains account identities and request metadata even though it excludes credential material. It is not encrypted backup tooling or a public content export. Any future credential types must also participate in recovery invalidation.

## Validate in Docker

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd infra/account-manager test:isolated
bun run --cwd infra/account-manager lint
bun run --cwd infra/account-manager build
```

The isolated command starts its own PostgreSQL container, creates distinct manager and relay roles/databases, runs the real-store tests, then builds and runs `Dockerfile.smoke`. Google verification tests use real disposable RSA keys and an HTTP public-key fixture inside the test container. The smoke imports the actual bundled `authority.js` and uses copied generated migrations without a developer checkout or dependency install in its runtime image. It checks restart, duplicate issuance, revocation, restore invalidation/retry, Google verification and browser-bound owner sessions. The source suite also proves migration upgrade preservation and controlled lifecycle races. No live Google account or OAuth secret is used.

The Linux isolated infrastructure CI job runs the source suite and built image explicitly, alongside the relay checks. Manager changes select that job. Cross-platform package checks still build and lint this private owner; it has no ordinary `test` target that would launch Linux containers from Windows. Existing allowances and workloads remain unchanged. For a focused source file, append its path to `test:isolated`, such as `src/recovery.test.ts`; the built smoke still follows a passing source run.

Each run prints `manager-authority-<uuid>`. Its PostgreSQL data, containers and internal network belong to that run and are removed in cleanup. It publishes no host ports and mounts source read-only only in the source tester. The built smoke has no source mount. Fixture credentials are test-only. The developer application's database and unrelated Docker projects are never opened or changed.

The default fixture subnet is `10.254.234.0/24`. Run these fixtures sequentially, or set `MANAGER_TEST_SUBNET` to a separately inspected unused subnet. Role-denial success proves this fixture's permissions; live hosting must configure and validate its own manager/relay separation.
