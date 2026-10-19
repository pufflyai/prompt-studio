# Device login development

The native host keeps one device credential per login. The account manager owns Google sign-in, accounts, devices, cloud projects and renewal ([PRD 0014](../../requirements/platform/0014-local-first-sync.md), R34, R35, R37). Extensions keep their normal storage, file and editor APIs. The dashboard UI is separate work in PS-784.

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
- If the manager answers 401, another device removed this one. The host clears its login and stops syncing.
- A project that another device makes a cloud project later starts syncing here at the next start, login, or project create or bind.

The device credential never leaves the native host. Host API responses and extension events do not include it.

## Host and manager APIs

| Host route | Purpose |
| --- | --- |
| `POST /v1/account/login`, `GET /v1/account/login/:id` | Start a login and read its status. |
| `GET /v1/account` | This device's login, without the credential, and the account's cloud projects. |
| `POST /v1/account/logout` | Remove this device at the manager and clear the login. |
| `GET /v1/account/devices` | The account's devices, with `current` set for this one. |
| `POST /v1/account/devices/:id/rename`, `POST /v1/account/devices/:id/remove` | Rename or remove a device. Removing this device logs out. |
| `PUT /v1/account/projects/:id`, `DELETE /v1/account/projects/:id` | Make a local project a cloud project, or stop syncing it. |

The manager routes are listed in [account authority development](0007-account-manager.md#better-auth-and-http).

The public SDK `/client` account methods are additive API changes. API `0.2.1` records that step under [API versioning](../../references/extensions/0014-api-versioning.md#public-sdk-subpaths). Existing `^0.2.0` extension ranges still accept this version; no manifest range changes are needed.

The browser bridge uses Better Auth's [single-use token plugin](https://better-auth.com/docs/plugins/one-time-token) and [bearer session plugin](https://better-auth.com/docs/plugins/bearer). It adds no auth provider or hosted execution service.

## Local verification

Run the focused Docker checks:

```sh
bun run --cwd infra/account-manager test:isolated src/native-devices.test.ts src/native-login.test.ts src/manager-http.test.ts src/google-library.test.ts
```

`native-devices.test.ts` starts an owned HTTPS manager and runs [`native-devices.integration.ts`](../../../packages/pstdio-api/src/services/account/native-devices.integration.ts) against it. Two host fixtures log in as devices of one Google user. Each sees both devices; one renames and removes the other; the removed device stops renewing and stops syncing. A restarted device keeps its login. A cloud project turns on and off, logout clears the login, a second Google user gets a separate account, and local data written before login stays unchanged.

The relay runtime test checks that adding a cloud project keeps earlier sockets, that a changed credential discards stale in-flight starts, and that removed projects stop syncing. The packaged smoke checks full-host account wiring and that projects stay local without a login.

These checks use owned provider and session fixtures. They do not prove live Google sign-in. Verify the browser flow separately with two owned Google accounts and the real service URLs: log in on two devices, list, rename and remove devices, turn a project's sync on and off, and restart. Record the service URLs, account IDs, device IDs and project IDs in the evidence, with secrets left out.
