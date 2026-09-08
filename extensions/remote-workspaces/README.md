# Remote Workspaces

Run PocketCoder workspaces on your desktop while Prompt Studio runs on another machine. The extension package is named `remote-workspaces` and its ID is `pstdio.remote-workspaces`.

PocketCoder runs the containers and coding agent. Prompt Studio sends prompts, displays the conversation, and manages workspace records. Model credentials and repository access belong on the PocketCoder machine. Your local project files are not copied to the desktop.

## Start PocketCoder on the desktop

These commands use PocketCoder's source deployment with Pi and an OpenAI model. You need Bun 1.3.14 or later, Docker, Git, and SSH access to the desktop. On Windows, run the commands in a Linux environment with working Docker access. Other agents need their own runnable PocketCoder template.

Clone PocketCoder on the desktop:

```sh
git clone git@github.com:pufflyai/pocketcoder.git
cd pocketcoder
bun install
docker compose -f deploy/compose/docker-compose.yaml up -d --wait postgres
```

Create a host-side authentication secret once:

```sh
umask 077
mkdir -p "$HOME/.config/pocketcoder"
openssl rand -base64 32 > "$HOME/.config/pocketcoder/auth-pepper"
```

Keep that file and reuse it on every restart. Do not regenerate it for an existing database. In the shell that will run PocketCoder:

```sh
export POCKETCODER_DATABASE_URL=postgres://pocketcoder:pocketcoder@127.0.0.1:5433/pocketcoder
export POCKETCODER_AUTH_PEPPER="$(cat "$HOME/.config/pocketcoder/auth-pepper")"
bun run pcd -- db migrate
```

Create a principal for Prompt Studio. A principal is a caller with explicit permissions:

```sh
bun run pcd -- principals create --name prompt-studio \
  --scopes templates:read,workspaces:create,workspaces:read,workspaces:cancel,services:relay,conversations:read,logs:read \
  --templates pi-harness
bun run pcd -- keys issue --principal prompt-studio --expires 2027-01-01T00:00:00Z
```

Choose an expiry in the future. PocketCoder prints a `pkt_...` machine key once. Save it for the Prompt Studio connection. This key is different from your model provider's API key.

Start the runnable agent deployment in the same shell. Replace the two values with your OpenAI key and an available model ID:

```sh
export OPENAI_API_KEY='your-openai-api-key'
export OPENAI_MODEL='your-model-id'
bun run local:up -- --template pi-harness --openai
```

Keep this process running. It builds the Pi container image, writes a runtime template under `.pocketcoder/local/templates`, starts the host model gateway, and starts PocketCoder on port 7080. The OpenAI key stays in the gateway process. The database survives restarts.

The checked-in `examples/templates` directory in PocketCoder contains placeholder manifests. `local:up` materializes a runnable template; starting the server alone does not build an agent image or start a gateway. Rerunning `local:up` rotates the gateway bearer, so finish existing workspaces before restarting it.

With Docker Desktop, workspaces reach the host through `host.docker.internal`. With native Linux Docker, set `POCKETCODER_HOST=0.0.0.0` before `local:up` so the containers can reach the API through their host gateway. Permit the Docker network to reach ports 7080 and 8080, and keep these ports off the public internet. SSH is the connection between machines. The desktop must stay awake while workspaces run.

In another desktop terminal, verify the service using the issued PocketCoder key:

```sh
export POCKETCODER_URL=http://127.0.0.1:7080
export POCKETCODER_KEY='pkt_your-machine-key'
bun run pcd -- templates list
bun run pcd -- doctor --template pi-harness --turn-timeout-seconds 60
```

`doctor: ok` proves the service can create a workspace and get an agent response. It uses a small model call. If it fails, fix the desktop deployment before connecting Prompt Studio.

## Connect from the Prompt Studio machine

Enable SSH access on the desktop and use its reachable hostname or IP address. On the machine running the Prompt Studio server, keep this tunnel open:

```sh
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -L 127.0.0.1:17080:127.0.0.1:7080 your-user@your-desktop
```

Port 17080 on this machine now forwards to PocketCoder's port 7080 on the desktop. This is SSH [local port forwarding](https://man.openbsd.org/ssh.1#L). Check the tunnel:

```sh
curl --fail http://127.0.0.1:17080/livez
```

The tunnel must be reachable from the Prompt Studio **server**, which makes the connection requests. If that server runs in Docker, `127.0.0.1` refers to its container. Run the tunnel in the server's network namespace, or give PocketCoder an HTTPS endpoint reachable from that container. Prompt Studio requires HTTPS for every non-loopback connection URL.

From a Prompt Studio checkout, inside a linked project:

```sh
pst extensions add ./extensions/remote-workspaces --force
pst extensions check
```

Open **Settings → Extensions → Remote Workspaces → Connections**:

1. Under **PocketCoder**, enter `http://127.0.0.1:17080` as the base URL. Do not add `/v1`.
2. Enter the `pkt_...` machine key without a `Bearer ` prefix.
3. Select **Connect**, then **Check**. The check calls the authenticated `GET /v1/templates` endpoint.

Connection settings belong to each project. The host stores the credential and adds the authorization header. Enable and configure the extension in every project where you need it.

You can repeat the check from the CLI:

```sh
pst connections check --project <project-id> \
  --extension pstdio.remote-workspaces --connection pocketcoder
```

## Run a workspace

Choose **Launch PocketCoder session** from the command palette or project actions menu. Set **PocketCoder template** to `pi-harness`, leave the optional fields empty, and enter a prompt. The command waits for the workspace to become ready and starts its agent session.

The equivalent CLI command is:

```sh
pst remote-workspaces launch --template pi-harness \
  --prompt 'Inspect the workspace and describe its files'
```

The result contains `workspaceId` and `sessionId`. Open the session to see output and send follow-ups. Each PocketCoder workspace owns one conversation. Follow-ups continue that conversation; output snapshots refresh while the agent runs. Prompt Studio can reattach to a running conversation after a host restart without submitting the prompt again.

If a submit response is lost, the extension reads the existing conversation instead of resending the prompt. If the service remains unreachable, the session becomes disconnected. Check PocketCoder's conversation before manually repeating a prompt whose outcome is unknown.

PocketCoder does not provide idempotent turn IDs. The extension saves a non-secret conversation cursor for each pending turn so restart recovery does not mistake an earlier reply for a new one. See the [temporary turn-cursor decision](../../.pstdio/docs/adrs/0022-temporary-pocketcoder-turn-cursor.md).

**Stop cancels the entire PocketCoder workspace.** Deleting a Prompt Studio workspace also cancels the remote execution and waits for a terminal state. PocketCoder retains its historical record. A canceled or expired workspace cannot accept follow-ups; launch a new one. This extension does not expose checkpoint restore, archive, file browsing, diff, merge, or attachments.

### Work on your own repository

The generated `pi-harness` template starts with PocketCoder's test project. To work on your code, deploy a template that prepares your repository on the desktop. PocketCoder's [template guide](https://github.com/pufflyai/pocketcoder/blob/main/docs/templates.md) describes repository aliases, source checkout, secrets, and persistent mounts.

For a template that declares a Git source, enter its **Repository alias**, such as `app`, and a **Branch, tag, or commit**, such as `main`. Supply both fields. The alias is a key in the template's `spec.source.repositories`, not a Git URL or a local path. The template controls which repositories callers may access. Set **Template version** only when you need a specific version; otherwise PocketCoder selects the current one.

To run Codex, Claude Code, or OpenCode, install a runnable template for that agent on the desktop, allow its name on the principal, and select that template in Prompt Studio. The extension uses the agent selected by the template.

## External automation

Issue a Prompt Studio machine token scoped to the project and `pstdio.remote-workspaces.command.launch`. Set `PSTDIO_AUTOMATION_TOKEN` and, if needed, `PSTDIO_API_URL` in the caller's environment:

```sh
pst automation run --project <project-id> \
  --command pstdio.remote-workspaces.command.launch \
  --idempotency-key desktop-task-42 \
  --input '{"template":"pi-harness","prompt":"Inspect the project"}'
```

Reuse the same idempotency key when retrying the same launch request. Use a new key for a new task. The automation result identifies the workspace and session; it does not wait for the agent to finish.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | PocketCoder, the SSH tunnel, and the desktop are running. Test `/livez` from the Prompt Studio server. |
| HTTP 401 | The PocketCoder key is correct and unexpired. The desktop uses the same authentication pepper as when the key was issued. |
| HTTP 403 | The principal has the scopes above and allows the selected template. |
| Template missing or launch failed | Run `pcd templates list` and `pcd doctor` on the desktop. Use a materialized runtime template. |
| Workspace never reaches ready | Check Docker access, image build, container access to port 7080, and template setup logs. |
| Agent cannot reach the model | The desktop gateway is running on port 8080, its key and model are valid, and the workspace has the current gateway bearer. |
| Files differ from the local project | PocketCoder uses its template's filesystem. Configure repository checkout in that template. |

## Development

Follow Prompt Studio's isolated Docker workflow. Watch changes with `PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev ./extensions/remote-workspaces` against that host. Validate with:

```sh
bun test extensions/remote-workspaces
bun run --cwd extensions/remote-workspaces typecheck
bun run verify:translations
bun run validate
```

The adapter uses PocketCoder's workspace API, AgentAPI `/message`, `/messages`, and `/status` relay routes, and durable `/conversation` history. It polls complete transcript snapshots once per second. See PocketCoder's [HTTP API](https://github.com/pufflyai/pocketcoder/blob/main/docs/api.md) and [deployment guide](https://github.com/pufflyai/pocketcoder/blob/main/docs/deployment.md).
