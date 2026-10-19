# Connect workbenches

Use Google sign-in to connect local workbenches for synchronization. The native host keeps owner sessions and environment credentials private.

## Sign in and create an account

Use the trusted HTTPS account service URL supplied by your administrator. The examples use `https://accounts.example.test`; replace it with your service's full origin.

```sh
pst account login --manager https://accounts.example.test
pst account status --manager https://accounts.example.test
pst account create --manager https://accounts.example.test
```

Sign-in opens Google in the system browser on the computer running the native host. Use `--open-browser=false` to open the printed URL manually on that same computer. A remote host needs its own browser and loopback access; the dashboard does not forward this callback.

`account status` lists accounts owned by the signed-in Google identity. `account create` creates a stable account for that identity, or returns the same account on a retry. It never reactivates a disabled account. Copy the returned account ID into the commands below. Account IDs identify accounts; they contain no credential.

## Create or select a workbench

Create a local workbench normally, or select its existing project ID:

```sh
pst projects create Notes --path /absolute/path/to/notes
pst projects list
pst projects environment
pst account workbenches --manager https://accounts.example.test --account ACCOUNT_ID
pst account connect WORKBENCH_ID --manager https://accounts.example.test --account ACCOUNT_ID --expires-at 2027-01-01T00:00:00.000Z
```

For a workbench that already exists in another environment, bind its stable identity to this computer's folder first:

```sh
pst projects bind WORKBENCH_ID --environment ENVIRONMENT_ID --name Notes --path /absolute/path/to/notes
```

The environment ID comes from `projects environment` on this host. A workbench ID never carries another computer's folder, workspace ID or credentials.

`connect` adds enrollment to the selected local workbench. It preserves its project ID, folder, local records and offline journal. Connecting a second workbench retains earlier connections and credentials. A workbench already enrolled under a different account, manager or environment is refused.

A successful connection means enrollment was saved. It does not assert that every record or asset has synchronized. Workbenches you have not connected stay local and work without an owner account.

## Retry, revoke and sign out

If enrollment is interrupted, repeat `connect` with the same workbench and owner. The host recovers a lost response using the original request identity and an authenticated replacement when needed. It keeps other workbenches connected.

```sh
pst account environments --manager https://accounts.example.test --account ACCOUNT_ID
pst account revoke ENVIRONMENT_ID --manager https://accounts.example.test --account ACCOUNT_ID
pst account sign-out --manager https://accounts.example.test
```

The environment list contains safe grant metadata, expiry and revocation. Revocation denies future renewal across that account's workbenches in the selected environment. Already issued finite access stays valid until its expiry. Signing out closes the human session; enrolled environments have separate authority and local-only workbenches keep working.

After a grant expires or is revoked, sign in and run `connect` again with a future expiry. A service outage leaves saved credentials unchanged. An active enrollment reuses its existing grant; the expiry argument applies when a fresh grant is needed. An interrupted request keeps its original expiry until that request expires.

## Native storage and SDK

The host stores `native-account.json` and `relay-connections.json` beside its database. With `PSTDIO_DB_PATH=/state/pstdio.db`, their full paths are `/state/native-account.json` and `/state/relay-connections.json`. `PSTDIO_RELAY_CONFIG_FILE` can select the native connection file explicitly. Keep these private native files out of project storage, extension files, synchronized content, screenshots and logs.

Authenticated host APIs are available through `createClient(...).account` in `@pstdio/sdk/client`. They include login/status, account inspection/creation, workbench and environment lists, connect, revoke and sign-out. Responses contain safe metadata; owner sessions and environment grants stay in the host.

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient();
const login = await client.account.login("https://accounts.example.test");
// Open login.url on the native host's computer, then inspect its status.
const status = await client.account.loginStatus(login.id);
const connections = await client.account.connections();
```

See [AccountClient](../../../packages/sdk/src/client/account.ts) for exact method signatures and safe response types.
