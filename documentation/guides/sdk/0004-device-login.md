# Log in and sync cloud projects

Log in once with Google on each computer. Each computer becomes a device of your account and syncs your cloud projects. There is no step to connect each project. Projects you do not make cloud projects stay local.

## Log in

Use the HTTPS account service URL from your administrator. The examples use `https://accounts.example.test`.

```sh
pst login --manager https://accounts.example.test
```

Login opens Google in the system browser on the computer that runs the native host. Use `--open-browser=false` to open the printed URL yourself on that same computer. A remote host needs its own browser and loopback access; the dashboard does not forward this callback.

After login, the host keeps one device credential. It does not keep your Google session. Logging in again on the same computer replaces the credential.

## Make a project a cloud project

```sh
pst projects list
pst projects cloud PROJECT_ID
```

The project keeps its ID, folder and local data. Every device of your account that has this project syncs it. To get the project on another computer, log in there and bind the same project ID to a folder:

```sh
pst projects environment
pst projects bind PROJECT_ID --environment ENVIRONMENT_ID --name Notes --path /absolute/path/to/notes
```

The environment ID comes from `pst projects environment` on that computer. A device notices a cloud project when it starts, logs in, or creates or binds the project.

To stop syncing a project, run `pst projects local PROJECT_ID`. Every device keeps its local copy.

## Manage devices

```sh
pst devices list
pst devices rename DEVICE_ID "Work laptop"
pst devices remove DEVICE_ID
pst logout
```

`devices list` marks the current device with `*`. Removing a device stops it from renewing access. Access it already has ends within the access lifetime the service sets. Data already on that device stays there. `pst logout` removes the current device and stops its sync. If the account service cannot be reached, it still logs out here; remove the device from another one later.

## Native storage and SDK

The host stores its device login in `native-account.json` beside its database, with mode `0600`. With `PSTDIO_DB_PATH=/state/pstdio.db`, the path is `/state/native-account.json`. `PSTDIO_ACCOUNT_FILE` selects another path. Keep this file out of project storage, extension files, synced content, screenshots and logs.

The host APIs are available through `createClient(...).account` in `@pstdio/sdk/client`. Responses never contain the device credential.

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();
const login = await client.account.login("https://accounts.example.test");
// Open login.url on the native host's computer, then wait for "complete".
const { status } = await client.account.loginStatus(login.id);
const devices = await client.account.devices();
await client.account.syncProject("PROJECT_ID");
```

See [AccountClient](../../../packages/sdk/src/client/account.ts) for the exact methods and response types.

On current `main`, the dashboard also provides [Cloud settings and sync status](../getting-started/0006-cloud-sync.md). `account.login()` without an origin uses the runtime's configured service. `account.cancelLogin(id)` cancels a pending native login. `account.projectSyncStatus(projectId)` returns one of the six project states and whether all known content has been verified locally. These additions use the same API 0.2.1 additive step as device login.
