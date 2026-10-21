# Device login development

The native host keeps one device credential per login. The account manager owns Google sign-in, accounts, devices, cloud projects and renewal ([PRD 0014](../../requirements/platform/0014-local-first-sync.md), R34, R35, R37). Extensions keep their normal storage, file and editor APIs. The Cloud UI is separate work: PS-784 gives extensions the account, devices and sync status through the SDK, and the bundled Prompt Studio Cloud extension shows them (PS-875, R55).

See [Log in and sync cloud projects](../sdk/0004-device-login.md) for the commands, the native file path and SDK usage.

## Account service setup

Use an owned HTTPS account service configured as described in [account authority development](0007-account-manager.md). Register its full Google callback URL, for example `https://accounts.example.test/api/auth/callback/google`, in the owned Google OAuth client. `MANAGER_ORIGIN` is that account service's origin; `RELAY_AUDIENCE` is the full HTTPS relay origin. These are separate services and identities.

This repository supplies no live Google OAuth client or account service. The commands assume an existing owned service. They do not create cloud resources or deploy anything.

## Login flow

1. `pst login` asks the host to start a login. The host opens a random `http://127.0.0.1:<port>/callback` listener and returns the manager's `/v1/native-login` URL.
2. Better Auth signs the user in with Google. The manager redirects a short-lived, single-use code to the loopback listener. The listener checks its state and exact host.
3. The host exchanges the code for a Google session and calls `POST /v1/device-login` with its environment ID as device ID, the computer's host name and its platform.
4. The manager finds or creates the user's account and returns a device credential. The host signs the Google session out and saves the device login in `native-account.json` with an atomic private write (mode `0600`).
5. The host loads the account's cloud projects and starts syncing the ones that exist locally.

Closing a pending login stops its in-flight exchange and the write that follows it.

## Cloud projects on the host

[`createNativeAccount`](../../../packages/pstdio-api/src/services/account/native-account.ts) keeps the account's cloud project list in memory. It loads the list from `GET /v1/workbenches` at startup, after login, after `pst projects cloud` or `pst projects local`, and when a local project is created or bound. It then hands the relay runtime one connection per cloud project that exists on this device. The relay runtime restarts only the projects whose connection changed.

- If the manager cannot be reached, local work goes on and the host tries again every minute.
- If the manager answers 401 to any account request, another device removed this one. The host clears its login and stops syncing. It clears only the credential that was rejected, so a newer login stays.
- If the relay's access renewal gets a 401, the host refreshes its list. That stops a removed device, and a project that another device stopped syncing.
- A login saved for another environment ID, for example by another database in the same folder, counts as logged out.
- `pst logout` clears the login even when the manager cannot be reached. The device then stays on the account's list until another device removes it.
- A project that another device makes a cloud project later starts syncing here at the next start, login, or project create or bind.

The device credential never leaves the native host. Host API responses and extension events do not include it.

## Host and manager APIs

| Host route | Purpose |
| --- | --- |
| `POST /v1/account/login`, `GET /v1/account/login/:id` | Start a login and read its status. |
| `GET /v1/account` | This device's login, without the credential, and the account's cloud projects. |
| `POST /v1/account/logout` | Clear the login and remove this device at the manager. `removed` is false when the manager could not be reached. |
| `GET /v1/account/devices` | The account's devices, with `current` set for this one. |
| `POST /v1/account/devices/:id/rename`, `POST /v1/account/devices/:id/remove` | Rename or remove a device. Removing this device logs out. |
| `PUT /v1/account/projects/:id`, `DELETE /v1/account/projects/:id` | Make a local project a cloud project, or stop syncing it. |

The manager routes are listed in [account authority development](0007-account-manager.md#better-auth-and-http).

The public SDK `/client` account methods are additive API changes. API `0.2.1` records that step under [API versioning](../../references/extensions/0014-api-versioning.md#public-sdk-subpaths). Existing `^0.2.0` extension ranges still accept this version; no manifest range changes are needed.

The browser bridge uses Better Auth's [single-use token plugin](https://better-auth.com/docs/plugins/one-time-token) and [bearer session plugin](https://better-auth.com/docs/plugins/bearer). It adds no auth provider or hosted execution service.

## Local verification

Run the focused Docker checks:

```sh
bun run --cwd services/account-manager test:isolated src/native-devices.test.ts src/native-login.test.ts src/manager-http.test.ts src/google-library.test.ts
```

`native-devices.test.ts` starts an owned HTTPS manager and runs [`native-devices.integration.ts`](../../../packages/pstdio-api/src/services/account/native-devices.integration.ts) against it. Two host fixtures log in as devices of one Google user. Each sees both devices; one renames and removes the other; the removed device stops renewing and stops syncing. A restarted device keeps its login. A cloud project turns on and off, logout clears the login, a second Google user gets a separate account, and local data written before login stays unchanged.

The relay runtime test checks that adding a cloud project keeps earlier sockets, that a changed credential discards stale in-flight starts, and that removed projects stop syncing. The packaged smoke checks full-host account wiring and that projects stay local without a login.

These checks use owned provider and session fixtures. They do not prove live Google sign-in. Verify the browser flow separately with two owned Google accounts and the real service URLs: log in on two devices, list, rename and remove devices, turn a project's sync on and off, and restart. Record the service URLs, account IDs, device IDs and project IDs in the evidence, with secrets left out.

## Sync status and presence

`DELETE /v1/account/login/:id` cancels a pending login. `GET /v1/account/projects/:id/sync` returns `state` and `offlineReady` from the relay document and connection owners. `ctx.account`, the `account.read` and `account.manage` webview capabilities, and `accountEvents.projectSyncChanged` expose the same owners to extensions. No caller stores a second sync status.

The document owner verifies blob bytes before marking a download complete. Status compares durable local edits against the relay replica, so later local changes stop reporting synced. The project aggregate waits for the core resource numbers and for every enabled extension's records document and discovered text documents. Quarantined data reports needs attention. A missing account project list is unknown, rather than evidence that every project is local-only.

The relay owners signal when a connection opens or closes, when a sync run ends, and when local storage changes. Account changes signal every project. The host then reads each signalled project's status again and sends `accountEvents.projectSyncChanged` only when the status differs from the last one it sent.

The native account owner sends `POST /v1/devices/presence` every 15 seconds, even without a Cloud project. The account manager updates its existing `lastSeenAt`; device lists derive `online` from that timestamp and a 45-second lease using the database clock. A successful login or access renewal also proves contact. No separate stored online flag or new table is needed. Removal rejects future heartbeats; logout stops them. Other manager replicas see the same presence because PostgreSQL owns the timestamp.

The packaged document sync smoke checks the `local`, `synced` and `needs-attention` states on a compiled host. The packaged two-device smoke runs two compiled hosts against a wire-level relay peer. It checks that an interrupted first download stays `first-download-incomplete` while offline, that a connected device goes `offline` and back to `synced`, and that edits made on both devices while the project is local merge when it syncs again. The packaged account smoke checks sign-in cancellation and presence.
