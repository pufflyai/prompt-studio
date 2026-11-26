# Cloud Workspaces

Manage deployed PocketCoder workspaces, local controller instances, logs, previews, and activity. This extension uses user scope. Its source is published for review, but it stays outside the downloadable catalog and extension releases.

## Install

From the Prompt Studio checkout:

```sh
pst extensions add ./extensions/cloud-workspaces --name cloud-workspaces --force
pst extensions add ./extensions/remote-testing --name remote-testing --force
```

The Remote Testing companion provides source upload, cloud execution, result collection, and the agent commands used by the bundled skills. Both packages require host support for global connections.

## Connect a deployment

Open Cloud Workspaces in extension settings. Configure **Deployed PocketCoder controller** with your controller endpoint and an expiring key. This is one global connection on the device: configuring or revoking it in any local project applies to every project that enables the extension.

Use `templates:read`, `workspaces:read`, `conversations:read`, and `logs:read` to browse the deployment. Add `workspaces:create` and `workspaces:cancel` to launch and stop workspaces. Limit keys to the required template families. The controller decides which machines and templates the principal may see.

Deployment endpoints and credentials belong in host-managed connection settings. Keep Google authentication, provider credentials, operator helpers, and deployment configuration outside the repository. Shared packages contain source and dependency manifests. Workspace credentials must be scoped to that workspace and expire with it.

## Workspace Monitoring

Open **Cloud Workspaces → Deployed PocketCoder → Workspace Monitoring**. The overview covers the last hour, 24 hours, or seven days. Use the shared search and filter controls to find workspaces by exact name or state, then select a workspace to see its timeline, ready time, and estimate. Use **Open output and logs** to inspect its operational details.

Set **Default workspace hourly rate (USD)** in the extension settings to apply one rate across the controller. To enter different rates on controllers that report activity by template, use **Workspace hourly rates (USD)**. Enter a JSON object with template names and USD per ready hour, for example `{"app-preview": 0.22, "test-runner": 0.55}`. A rate applies to every version of that template and to retained activity. The estimate covers ready time. The dashboard labels unpriced usage and shows a partial subtotal when some rates are missing. Aggregate estimates with different template rates require activity by template.

Read the same data through the CLI:

```sh
pst pocketcoder.pocketcoder deployed monitoring-summary --range week
pst pocketcoder.pocketcoder deployed monitoring-workspaces --state failed
pst pocketcoder.pocketcoder deployed monitoring-workspace --machine-id <workspace-id>
```

## Tests and demos

The bundled `run-cloud-tests` and `launch-cloud-demo` skills explain branch selection, explicit commands, full logs, source revisions, expiring links, and cleanup. Configure the companion's global runner and template-publisher connections, approved runtime templates, storage bucket, and URL signer. Run:

```sh
pst pocketcoder.remote-testing status
pst pocketcoder.remote-testing run --path /absolute/repository --command "bun install --frozen-lockfile && bun run test" --wait false
pst pocketcoder.remote-testing preview run --path /absolute/prompt-studio
```

Each test run starts an isolated workspace by default and stops it after its result is collected. A kept workspace can be selected explicitly within the project that created it. Save the run ID and full log path. Do not stop another agent's workspaces.

## Preview URL helper

Preview ingress is managed by the deployment operator. Provision an operator helper on the host, then set **Preview URL helper** in both Cloud Workspaces and Remote Testing settings. This device setting is shared across local projects. The helper is a TypeScript executable run with Bun. It accepts one workspace ID and prints JSON with `url` and `expiresAt`.

The helper must verify the selected workspace, return HTTPS URLs with bounded access, support the app's extension assets, and expire sessions with the workspace. Keep its ingress configuration and credentials outside the repository. The preview launcher checks for a configured helper before allocating a machine. Bridge capacity varies by deployment; coordinate before replacing an active preview target.

Use **Open app preview** from a ready preview machine, or:

```sh
pst pocketcoder.remote-testing preview open --workspace-id <workspace-id>
```

Login links are private task output. Keep them out of commits and public PR text.

## Dashboard

Open **Deployed instance** to browse Machines and Templates. The tables read the controller directly. Machines show their state and creation time. Open a workspace to inspect test output and controller logs. The Activity view reads cloud history from the controller.

Use **Launch workspace** to choose a published template. Select several machines to **Stop selected** or **Delete selected**. Actions run in the background. Delete stops execution and dismisses the row from this project; controller audit history and saved logs remain available.

## Local controllers

Local instances require Docker and a PocketCoder executable. Supply its absolute path, install it on PATH, or build it in a separate PocketCoder checkout. Prompt Studio does not provide that repository's build command.

Local instance state lives in the host's private data directory. Runtime owner keys expire after one day and stay outside project files. Build a local Prompt Studio/Codex template with:

```sh
bun extensions/cloud-workspaces/src/codex-template/prepare.ts /absolute/pocketcoder-checkout
```

## Validate

```sh
bun run --cwd extensions/cloud-workspaces typecheck
pst extensions check ./extensions/cloud-workspaces
```

Cloud smoke runs verify test collection, automatic shutdown, and runnable previews. Controller-specific Docker conformance tests belong in the PocketCoder repository.
