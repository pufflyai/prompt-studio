# Remote Execution

Run agent sessions on a remote service from Prompt Studio. This extension provides a remote workspace type, an agent harness that runs without a local working directory, and a launch command for the dashboard and external automation.

You need a remote service that implements the HTTP contract below. The extension does not include a server or provision compute. Your service owns repository cloning, compute, and agent credentials. Prompt Studio stores a non-secret workspace reference and sends requests through a host-managed connection.

## Install

From a checkout of this repository, run these commands inside a linked project:

```sh
pst extensions add ./extensions/remote-execution
pst extensions check
```

The extension installs in the user scope and is enabled for the current project. Enable it in **Settings → Extensions** for other projects where you want to use it.

Once this extension is included in your host's release, you can install it by name:

```sh
pst extensions add remote-execution
```

## Connect your remote service

1. Open the project's **Settings → Extensions → Remote Execution → Connections**.
2. Under **Remote control plane**, enter your service's base URL, such as `https://compute.example.com`. The extension appends paths beginning with `/v1`.
3. Enter the service's bearer credential, without the `Bearer ` prefix, and select **Connect**.
4. Select **Check**. The service must return a successful HTTP status from `GET /v1/workspaces/health`.

The host stores the credential and adds the authorization header. Keep agent-provider credentials on your remote service. Connection settings belong to the project, so configure each project separately.

You can also check the connection from the CLI. Replace `<project-id>` with your project's ID:

```sh
pst connections check \
  --project <project-id> \
  --extension pstdio.remote-execution \
  --connection control-plane
```

## Launch a session

Open the command palette or the project's actions menu and choose **Launch remote session**. Enter the repository in the format your remote service accepts and describe the task in **Prompt**.

The command creates a remote workspace, starts a session using **Remote agent**, and returns `workspaceId` and `sessionId`. Open the session from the project's sessions list to read messages or send a follow-up. Stopping the session requests remote cancellation. The harness supports reattachment after a host restart without submitting the prompt again.

## Use external automation

Issue a machine token in **Settings → Machine tokens** for this project with this exact command scope:

```text
pstdio.remote-execution.command.launch
```

Set `PSTDIO_AUTOMATION_TOKEN` to that token in your automation environment. Set `PSTDIO_API_URL` to the Prompt Studio API URL if it differs from `http://127.0.0.1:19840`. The machine token authorizes calls to Prompt Studio. The connection credential authorizes calls from Prompt Studio to your service.

```sh
pst automation run \
  --project <project-id> \
  --command pstdio.remote-execution.command.launch \
  --idempotency-key remote-task-42 \
  --input '{"repository":"your-org/your-repo","prompt":"Implement the task"}'
```

Reuse the same idempotency key when retrying the same request. Use a new key for each new task. Inspect the returned run ID with:

```sh
pst automation status --project <project-id> --id <run-id>
```

The automation run covers launching the session. Its result contains the workspace and session IDs; follow the session to track the agent's work.

## Remote service contract

All requests use the configured bearer credential. The connection permits `GET`, `POST`, and `DELETE` under `/v1/workspaces` and `/v1/sessions`. JSON responses must match the shapes consumed in [extension.ts](extension.ts).

| Method | Path | Request and response |
| --- | --- | --- |
| GET | `/v1/workspaces/health` | Return a successful HTTP status for a healthy connection. |
| POST | `/v1/workspaces` | Accept `{ operationId, repository }`; return a workspace result. |
| GET | `/v1/workspaces/{remoteId}` | Return the current workspace result. |
| POST | `/v1/workspaces/{remoteId}/cancel` | Accept `{ operationId }`; return the cancelled workspace result. |
| POST | `/v1/workspaces/{remoteId}/archive` | Accept `{ operationId }`; return the updated workspace result. |
| DELETE | `/v1/workspaces/{remoteId}` | Accept `{ operationId }`; delete the workspace and return a successful status. |
| POST | `/v1/workspaces/{remoteId}/sessions` | Accept `{ id, prompt }`; start the session and return `{ id }` using the supplied ID. |
| GET | `/v1/sessions/{id}/events` | Stream newline-delimited JSON message patches for the host event sink. |
| GET | `/v1/sessions/{id}` | Return `{ id, status }`, where status is `running`, `completed`, `failed`, or `cancelled`. |
| POST | `/v1/sessions/{id}/follow-ups` | Accept `{ hostSessionId, requestId, prompt }`; resume the session and return a successful status. |
| GET | `/v1/sessions/{id}/messages` | Return `{ messages }` containing SDK `SessionMessage` values. |
| DELETE | `/v1/sessions/{id}` | Stop and clean up the session; return a successful status. |

A ready workspace result looks like this:

```json
{
  "providerRef": { "version": 1, "data": { "remoteId": "workspace-123" } },
  "state": "ready",
  "executionKind": "remote",
  "executionTarget": {
    "kind": "remote",
    "providerId": "pstdio.remote-execution.workspace-type.remote",
    "providerRef": { "version": 1, "data": { "remoteId": "workspace-123" } }
  },
  "capabilities": {
    "files": "none",
    "diff": false,
    "merge": false,
    "rebase": false,
    "archive": true,
    "delete": true
  }
}
```

Use the SDK's `WorkspaceProviderResult` type for other lifecycle states. Keep `providerRef.data.remoteId` stable across requests and free of secrets. Advertise only capabilities your service supports.

Workspace mutations receive stable operation IDs. Session starts use the Prompt Studio session ID as the remote session ID. Follow-ups receive a request ID built from the host session ID and message offset. Your service must deduplicate these requests. If a start or follow-up fails after it may have been accepted, the harness requests deletion of the known session ID. Deletion must also be safe to retry.

Reattachment reads the existing session's events and state. It does not start a second session. The event endpoint must close when the session reaches a terminal state so the harness can read its final status.

If your service uses a different API, adapt the paths and response handling in `extension.ts`. Preserve stable IDs, deduplication, cleanup, and the connection's narrow method and path policy. See the [remote execution architecture](../../.pstdio/docs/architecture/remote-execution-and-automation.md) for the host's responsibilities.

## Development

Follow the repository's isolated Docker workflow. Use `pst extensions dev ./extensions/remote-execution` against that host to watch changes. Run the extension checks from the repository root:

```sh
bun test extensions/remote-execution
bun run --cwd extensions/remote-execution typecheck
bun run verify:translations
```
