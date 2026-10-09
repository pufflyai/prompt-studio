# Remote Workspaces

Remote Workspaces lets Prompt Studio run agent sessions on another computer, such as your desktop, through PocketCoder.

[PocketCoder](https://github.com/pufflyai/pocketcoder) is a separate service that runs coding agents in containers. It runs the containers and the agent. Prompt Studio sends your prompts, shows the conversation, and keeps track of the workspaces. Model credentials and repository access stay on the PocketCoder machine. Your local project files are not copied there.

This page calls the computer that runs PocketCoder the desktop. The extension's package name is `remote-workspaces`, and its ID is `pstdio.remote-workspaces`.

## Start PocketCoder on the desktop

These commands run PocketCoder from source with the Pi agent and an OpenAI model. You need Bun 1.4.2, Docker, Git, and SSH access to the desktop. On Windows, run the commands in a Linux environment with working Docker access. Other agents need their own runnable PocketCoder template. A template describes the container an agent runs in.

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

The `examples/templates` folder in PocketCoder holds placeholder templates only. `local:up` turns one into a runnable template. Starting the server alone does not build an agent image or start a gateway. Running `local:up` again creates a new gateway token, so finish running workspaces before you restart it.

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

Remote Workspaces is not in the built-in extension catalog yet. Install it from a copy of the Prompt Studio repository. Use the release tag that matches `pst --version`, then run the install from inside a linked project folder:

```sh
git clone --depth 1 --branch pstdio@<version> https://github.com/pufflyai/prompt-studio.git
pst extensions add <path-to>/prompt-studio/extensions/remote-workspaces
pst extensions check
```

Open **Settings → Project → Extensions** and select **Remote Workspaces**. On its **Settings** tab, find **Connections**:

1. Under **PocketCoder**, enter `http://127.0.0.1:17080` as the **Endpoint**. Do not add `/v1`.
2. Enter the `pkt_...` machine key as the **Credential**, without a `Bearer ` prefix.
3. Select **Connect**, then **Check**. The check calls PocketCoder's `GET /v1/templates` endpoint with the key.

Connection settings belong to each project. Prompt Studio stores the key and adds it to each request, so the extension never sees it. Enable and set up the extension in every project where you need it.

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

The result contains `workspaceId` and `sessionId`. Open the session to see the output and send follow-ups. Each PocketCoder workspace has one conversation, and follow-ups continue it. The output refreshes about once a second while the agent runs. After Prompt Studio restarts, it reconnects to a running conversation without sending the prompt again.

If a submit response is lost, the extension reads the existing conversation instead of resending the prompt. If the service remains unreachable, the session becomes disconnected. Check PocketCoder's conversation before manually repeating a prompt whose outcome is unknown.

PocketCoder does not give each turn a stable ID. So the extension saves a marker of the conversation's position for each pending turn. The marker holds no secrets. It keeps restart recovery from mistaking an earlier reply for a new one. See the [temporary turn-cursor decision](../../documentation/adrs/0022-temporary-pocketcoder-turn-cursor.md).

**Stop cancels the entire PocketCoder workspace.** Deleting a Prompt Studio workspace also cancels the remote work and waits until PocketCoder reports that it ended. PocketCoder keeps its own record of the workspace. Preserving remote workspaces appear as provisioning; preserved and succeeded workspaces appear as cancelled because they no longer accept work. A canceled or expired workspace cannot take follow-ups, so launch a new one. This extension does not offer checkpoint restore, archiving, file browsing, diffs, merging, or attachments.

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
| Template missing or launch failed | Run `pcd templates list` and `pcd doctor` on the desktop. Use the runtime template that `local:up` writes. |
| Workspace never reaches ready | Check Docker access, image build, container access to port 7080, and template setup logs. |
| Agent cannot reach the model | The desktop gateway is running on port 8080, its key and model are valid, and the workspace has the current gateway token. |
| Files differ from the local project | PocketCoder uses its template's filesystem. Configure repository checkout in that template. |
