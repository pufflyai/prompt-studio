# Remote Testing

Run this repository's test suite on a PocketCoder deployment instead of your machine, and
manage the remote test environments. Agents get the same commands and the
`run-tests-remotely` skill.

A run uploads the working tree as Git sees it: committed files, uncommitted edits and new
files that are not ignored. It starts an isolated test environment, runs the test
command there, stops the environment when the run finishes, and saves the full log under
`.pstdio/extension-storage/pocketcoder.remote-testing/runs/`.

## Collection

Prompt Studio collects results in the background after the CLI returns. If a runner
disappears without a final receipt, collection marks the run timed out after its command
duration and the existing 30-minute source-transfer and log-collection allowance, then
queues independent workspace cleanup and log collection. The recovery schedule is a
fallback; an explicit `runs show` always resumes collection for the saved run ID.
Uploaded timeout logs are backfilled without changing the saved outcome or duration.
A durable result checkpoint survives summary-write or ownership-release failures.
Workspace ownership remains held until cleanup accepts the stop.

## Commands

```sh
pst pocketcoder.remote-testing status
pst pocketcoder.remote-testing run --path "$(git rev-parse --show-toplevel)" [--command "<cmd>"] [--wait false] [--keep-environment true]
pst pocketcoder.remote-testing runs list | show --run-id <id> | cancel --run-id <id>
pst pocketcoder.remote-testing environments list | create | stop --environment <id> | stop --all
```

## Branch and workspace templates

Launch a test or preview from the CLI. Pass another repository or worktree with `--path`.

```sh
pst pocketcoder.remote-testing run --path /path/to/worktree --ref feature/my-branch
pst pocketcoder.remote-testing run --path /path/to/worktree --branch-template true
pst pocketcoder.remote-testing preview run --path /path/to/worktree --ref feature/my-branch
pst pocketcoder.remote-testing preview open --workspace-id <workspace-id>
pst pocketcoder.remote-testing templates branch --kind tests --path /path/to/worktree --ref feature/my-branch
```

`--ref` packages the named Git commit. With no ref, the launcher uses the current worktree, including uncommitted files that Git does not ignore. A branch launch publishes a version pinned to the source archive and starts it with that archive. Use `--command` if the workspace needs a different test command than the project default. Tests stop their machine after collection unless explicitly kept. Prompt Studio uses a build of the snapshot when the source is Prompt Studio itself, or opens the snapshot as a project in a pinned Prompt Studio release.

`templates branch` registers the version and returns its name. The launch commands also upload the source and start a workspace.

**preview open** uses an operator-managed helper configured in the device setting **Preview URL helper**. Provision this helper on the host before launching previews. It accepts one workspace ID as a command argument and prints JSON containing `url` and `expiresAt`. It must verify the target workspace, use HTTPS and bounded authentication, support extension assets, and expire sessions with the workspace. Keep ingress addresses, credentials and provider configuration outside the repository. The launcher checks for this helper before allocating a preview. The helper must provide an independent browser origin for each workspace. Opening one preview must preserve the routes and sessions of every other live preview.

## Kito previews

Enable **Kito API key** in Remote Testing settings on a configured Kito deployment. The **PocketCoder remote tests** connection publishes approved branch templates, signs run-specific source and log URLs, and opens previews. Host credentials stay outside cloud workspaces.

Each preview gets its own HTTPS hostname, cookie, dashboard login and application data. Run and open previews independently; there is no configured preview-count limit. Capacity depends on the deployment's compute, Gateway and certificate quotas. Opening the same workspace again creates a fresh one-use invitation without extending its existing session deadline. A new hostname can take several minutes to provision its certificate; `preview open` waits for verified HTTPS readiness and supports cancellation.

`preview run` returns `runId`, `workspaceId` and `template`. `preview open` returns `workspaceId`, `url` and `expiresAt`. Keep complete invitation URLs in private task evidence and share them only with the intended viewer. Invitation fragments disappear on sign-in. Session access ends at its recorded deadline or when its workspace stops. Kubernetes removes workspace-owned routes, Services and policies with the Pod; a durable certificate sweep also removes expired ingress and certificates after service restarts. Stop only an owned preview with `runs cancel --run-id <runId>` or `environments stop --environment <workspaceId>`.

Operators maintain the Kito bridge from this repository's [operator sources](operator/README.md). Existing previews using the old shared hostname can finish on that route; new previews use independent routes. A workspace launched with the old template must be relaunched to use isolated origins. Never reassign the shared route while a preview is running.

## Set up

Provision a PocketCoder deployment separately: a controller with the
`remote-tests` template, a Cloud Storage bucket and a URL signer account.

Connections are global on this device. Configure them once through any local project; changing or revoking them affects all projects that enable the extension.

1. Configure the **PocketCoder remote tests** connection with the controller URL and a
   finite machine key for the `remote-testing` principal. The host keeps the key; it never
   reaches settings, the repository or a test environment.
2. Set the extension settings: the template version, the test command, the bucket and the
   signer account.
3. Log in to Google once with `gcloud auth application-default login`. Uploads, downloads
   and URL signing use that login. Your account needs object access to the bucket and
   permission to sign as the signer account; the cluster stage grants both to
   `remote_test_developers`.

Equipped test environments are Linux amd64 workspaces with Bun, Git, strace, Chromium, Docker CLI and Compose. Each has its own Docker daemon, workspace volume and image store. Uploads preserve self-contained Git history and comparison refs without host Git configuration, hooks or credentials. Clean `--ref` runs preserve the exact commit; working-tree edits become a child commit. Agent tests, including `test:review`, primarily run here. See [Docker test runtime setup](../../documentation/guides/development/0024-cloud-test-workspaces.md) to upgrade an older deployment.

Set the session service's `process.env.HOME` to `/workspace` and
`process.env.POCKETCODER_SESSION_DIRECTORY` to `/workspace/.pocketcoder-sessions` in the
approved runner templates. The service starts with its declared environment; an image's
`ENV HOME` does not configure it. Browser installers use the home directory for caches.
The memory-backed `/tmp` is only 256 MiB and cannot hold a downloaded browser alongside
the producer journal. Keep both browser caches and that journal on the workspace volume.
Apply these values to the published default template and both approved branch bases.

For branch launches, install approved rendered manifests as `branch-templates/tests.json` and `branch-templates/preview.json` in this extension's project storage. Configure **PocketCoder branch templates** with a finite `templates:write` key scoped to `remote-tests-branch` and `prompt-studio-preview-branch`. Configure the runner key to launch both branch families. Both keys stay on the Prompt Studio host.

Source history covers the selected candidate and comparison base, with refs pointing into those histories. The default base is `origin/main` (then local `main` or `master` when available). Choose a named branch, tag, custom ref or commit SHA; resolve HEAD-relative expressions to a SHA on the host. Pass `--base <ref>` to the remote command for another comparison base, and use the same base in `test:review`. Fetch it on the host before upload. Unrelated workspace branch histories stay on the host.
