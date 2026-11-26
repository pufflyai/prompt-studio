---
name: launch-cloud-demo
description: Launch a runnable Prompt Studio demo from a repository branch or working tree on the deployed PocketCoder controller and obtain an expiring dashboard URL.
---

Cloud Workspaces uses the private Remote Testing companion (`pocketcoder.remote-testing`) to upload source and launch the approved Prompt Studio preview runtime. Run `pst` from the linked local project. Check `pst pocketcoder.remote-testing status` before launching. Connection credentials and Google authentication stay on the operator host, outside the uploaded source and extension package.

```sh
pst pocketcoder.remote-testing preview run --path /absolute/prompt-studio --timeout-minutes 60
```

The path selects the source checkout, including non-ignored working changes. Add `--ref <commit>` for a committed snapshot. Keep the returned `runId`, `workspaceId`, and template reference. The runner reuses the approved preview template family; do not create a template name for each agent or branch. The preview builds the dashboard when the source is the Prompt Studio monorepo.

Configure the operator-managed Preview URL helper on this device before launch, following the extension setup. Obtain the browser link:

```sh
pst pocketcoder.remote-testing preview open --workspace-id <workspaceId>
```

This waits for the app and returns `url` and `expiresAt`. Share the complete URL with the intended viewer. Its one-use login link and workspace session expire. Never substitute controller credentials into the URL or copy host credentials into the workspace.

Open the URL in a browser and verify the dashboard renders. Open at least one extension view and check its module loads, since a reachable shell alone does not prove the app works. Report the workspace ID, source revision or dirty snapshot, verified behavior, URL, and expiry. Leave a requested demo running until its bounded lifetime ends; stop it early only when it is no longer needed.

Each Kito preview has its own HTTPS hostname and browser session. Any number can remain open concurrently within available compute, Gateway and certificate quotas. Open each workspace ID separately and retain its own URL and expiry. The command waits for HTTPS readiness; a new certificate can take several minutes. Reopening a workspace creates another one-use invitation without extending its session deadline. Verify distinct origins and independent app state when testing isolation. An older workspace using the retired shared-host template must be relaunched; preserve its running route until its owner finishes.

Stop an owned preview with `pst pocketcoder.remote-testing runs cancel --run-id <runId>`, or `pst pocketcoder.remote-testing environments stop --environment <workspaceId>`. Never use `--all` while other agents are running work.
