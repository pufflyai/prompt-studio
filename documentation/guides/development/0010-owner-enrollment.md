# Owner enrollment development

The native host owns account sessions and environment credentials. The account manager owns Google sign-in, account ownership and renewal authority. Extensions keep their normal storage, file and editor APIs. Dashboard onboarding is separate work in PS-784.

See [Connect workbenches](../sdk/0004-owner-enrollment.md) for create, select, connect, retry, revoke and sign-out commands, native secret paths and SDK usage.

## Account service setup

Use an owned HTTPS account service configured as described in [account authority development](0007-account-manager.md). Register its full Google callback URL, for example `https://accounts.example.test/api/auth/callback/google`, in the owned Google OAuth client. `MANAGER_ORIGIN` is that account service's origin; `RELAY_AUDIENCE` is the full HTTPS relay origin. These are separate services and identities.

No live Google OAuth client or account service is supplied by this repository. The commands assume an existing owned service. They do not create cloud resources or deploy anything.

Better Auth receives Google's callback at the account service. It redirects a short-lived, single-use code to a random `http://127.0.0.1:<port>/callback` listener in the native host. The host exchanges the code and saves the library session itself. The loopback listener validates its state and exact host, and cancellation stops in-flight verification and queued session writes.

## Native ownership and retries

The host saves each workbench enrollment through an atomic private file write with mode `0600`. It retains earlier entries and rejects a changed account, manager or environment for the same workbench. The native runtime adds that workbench's connections without stopping others. In-flight extension starts must still own the current configuration before publishing their connection, including during credential recovery.

Before contacting the manager, the native owner saves the issuance intent. A committed request whose secret response was lost returns safe metadata. The host persists a new authenticated replacement intent naming that exact grant before making its next request. A second lost response can recover through the same rule. Pending intent is removed after the connection file is saved. No plaintext secret is recovered from manager storage or written into a request receipt. An expired pending intent can begin a fresh finite issuance request.

An existing enrollment probes current renewal authority. Only explicit denial permits fresh enrollment after owner authentication. Network and service failures leave its credential unchanged. Other workbenches keep their live connections and grants.

## Host and manager APIs

Authenticated host APIs live under `/v1/account`. `GET /v1/account/connections` returns safe enrollment metadata. `PUT /v1/projects/:id/enrollment` enrolls a locally created or bound project. Owner sessions and environment grants are never returned to callers or emitted as extension events.

The account service provides `GET/POST /v1/owner/accounts`, `GET /v1/owner/configuration`, `GET /v1/accounts/:accountId/workbenches`, and existing environment registration/replacement/revocation routes. Current Better Auth sessions and account ownership guard management. Native requests use the library's bearer session support; renewal grants remain separate.

The browser bridge uses Better Auth's [single-use token plugin](https://better-auth.com/docs/plugins/one-time-token) and [bearer session plugin](https://better-auth.com/docs/plugins/bearer). It adds no auth provider or hosted execution service.

## Local verification

Run the focused Docker checks:

```sh
bun run --cwd infra/account-manager test:isolated src/owner-enrollment.test.ts src/native-login.test.ts src/native-enrollment.test.ts src/manager-http.test.ts src/google-library.test.ts
```

The test prints its owned `https://127.0.0.1:<port>` manager URL and safe account, environment and workbench identities. Its PostgreSQL database, HTTPS certificate, local database and folders are disposable. The native test drives the actual account routes with real environment, project and journal owners. It retains offline work, loses both issuance and replacement responses after commit, restarts between retries, rejects mismatches, recovers revoked authority, preserves authority during an outage and signs out.

The persistence regression uses `transparent-workbench` and `built-network-workbench`, matching the user's reported fixture transition. Both enrollments must remain in the saved list. The separate relay runtime test verifies an earlier socket survives a new workbench and that credential rotation discards stale in-flight starts. Packaged smoke checks full-host account wiring and local-only independence.

These checks use owned provider/session fixtures. They do not establish live Google acceptance. Verify the browser flow separately with two owned Google accounts and actual service URLs, then repeat create/connect/revoke and restart. Record full service URLs, account IDs, workbench IDs and environment IDs in the evidence, with secrets omitted.
