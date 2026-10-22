# Log in and sync cloud projects

Log in once with Google on each computer. Each computer becomes a device of your account and syncs your cloud projects. There is no step to connect each project. Projects you do not make cloud projects stay local.

## Log in

Use the HTTPS account service URL from your administrator. It may include a path, such as `https://base.example.test/accounts`. The examples use `https://accounts.example.test`.

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

The project keeps its ID, folder and local data. Every device of your account syncs it, together with its name and the `origin` git remote of its folder. A device notices a new cloud project when it starts, logs in, creates or binds the project, or checks the account again, which it does every minute.

To stop syncing a project, run `pst projects local PROJECT_ID`. Every device keeps its local copy. A project that syncs cannot be deleted on one device, because every device of the account gets every cloud project back. Make it local first, then delete it.

## Get your cloud projects on a new computer

After you log in on a new or reset computer, every cloud project of your account appears in the project picker with its name. Its data, such as tickets, notes and artifacts, downloads without a folder. Until the first download finishes, the project reports `first-download-incomplete`.

The project's files come later. The first time something needs them, such as opening Files, creating a workspace or starting a session with an agent that works on files, Prompt Studio asks for a folder. It offers to clone the project's recorded git remote, or to use a folder that already holds the same repository. Work that needs files on a computer without the project's folder fails with the error "This project's files are not on this device."

To use a folder you already have from the command line, bind the project ID to it:

```sh
pst projects environment
pst projects bind PROJECT_ID --environment ENVIRONMENT_ID --name Notes --path /absolute/path/to/notes
```

The environment ID comes from `pst projects environment` on that computer.

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

On `main`, `account.cancelLogin(id)` cancels a pending native login. `account.projectSyncStatus(projectId)` returns the project's sync `state` and whether all known content has been verified on this device. These additions use the same API 0.2.1 additive step as device login.

`account.devices()` includes `online` for each device. The native runtime sends a presence heartbeat every 15 seconds without needing a Cloud project. Online means the account service heard from that device within 45 seconds. The manager computes the window with its own clock; clients do not infer online state from their wall clocks. `pst devices list` shows this status next to last seen.

## Extensions

Extensions use the same account through `ctx.account` and, in webviews, `client.account` with the `account.read` and `account.manage` capabilities. They receive `accountEvents.projectSyncChanged` when a project's sync status changes. See [Cloud account and sync status](../../references/extensions/0003-command-and-process-api.md#cloud-account-and-sync-status) for the methods and the meaning of each sync state.
