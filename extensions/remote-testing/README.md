# Remote Testing

Run this repository's test suite on a PocketCoder deployment instead of your machine, and
manage the remote test environments. Agents get the same commands and the
`run-tests-remotely` skill.

A run uploads the working tree as Git sees it: committed files, uncommitted edits and new
files that are not ignored. It starts an isolated test environment, runs the test
command there, stops the environment when the run finishes, and saves the full log under
`.pstdio/extension-storage/pocketcoder.remote-testing/runs/`.

## Remote tests page

**Remote tests** in the project sidebar has two tabs:

- **Runs**: every run with its status, command, the session that started it, environment,
  start time, duration, exit code and log. Prompt Studio collects results in the background
  after the CLI returns. Double-click a run, or use its menu, to
  open its session. The menu also cancels a running run.
- **Environments**: running test environments, whether each is free or which run holds it,
  whether it uses the current template, and when it stops. Start one ahead of time, stop one
  from its menu, or stop all.

`pst` passes the calling agent's session to `run` automatically, so agents do not need to do
anything for the link. Runs started outside a session show "Not recorded".

## Commands

```sh
pst pocketcoder.remote-testing status
pst pocketcoder.remote-testing run --path "$(git rev-parse --show-toplevel)" [--command "<cmd>"] [--wait false] [--keep-environment true]
pst pocketcoder.remote-testing runs list | show --run-id <id> | cancel --run-id <id>
pst pocketcoder.remote-testing environments list | create | stop --environment <id> | stop --all
```

## Branch and workspace templates

Use **Remote tests → Runs → Run tests** or **Run Prompt Studio**. An agent can also launch from this project's CLI and pass another repository or worktree with `--path`.

```sh
pst pocketcoder.remote-testing run --path /path/to/worktree --ref feature/my-branch
pst pocketcoder.remote-testing run --path /path/to/worktree --branch-template true
pst pocketcoder.remote-testing preview run --path /path/to/worktree --ref feature/my-branch
pst pocketcoder.remote-testing preview open --workspace-id <workspace-id>
pst pocketcoder.remote-testing templates branch --kind tests --path /path/to/worktree --ref feature/my-branch
```

`--ref` packages the named Git commit. With no ref, the launcher uses the current worktree, including uncommitted files that Git does not ignore. A branch launch publishes a version pinned to the source archive and starts it with that archive. Use `--command` if the workspace needs a different test command than the project default. Tests stop their machine after collection unless explicitly kept. Prompt Studio uses a build of the snapshot when the source is Prompt Studio itself, or opens the snapshot as a project in a pinned Prompt Studio release.

`templates branch` registers the version and returns its name. The launch commands also upload the source and start a workspace.

**preview open** uses an operator-managed helper configured in the device setting **Preview URL helper**. Provision this helper on the host before launching previews. It accepts one workspace ID as a command argument and prints JSON containing `url` and `expiresAt`. It must verify the target workspace, use HTTPS and bounded authentication, support extension assets, and expire sessions with the workspace. Keep ingress addresses, credentials and provider configuration outside the repository. The launcher checks for this helper before allocating a preview. Check the bridge capacity before opening concurrent previews.

## Set up

An operator can deploy [Cloud access](../../documentation/guides/development/0022-cloud-access.md)
to install this setup and renew per-person or per-run controller credentials
automatically. The client uses the current gcloud login or Microsoft device-code sign-in for people, or metadata identity for
Google-hosted VMs. It configures a separate Cloud run storage connection, which
keeps bucket and signing authority on the central service. Manual setup below keeps Application Default
Credentials as its default.

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

Test environments are Linux amd64 workspaces with Bun, Git, strace and Chromium. They have
no Docker, so suites that start containers still run locally.

For branch launches, install approved rendered manifests as `branch-templates/tests.json` and `branch-templates/preview.json` in this extension's project storage. Configure **PocketCoder branch templates** with a finite `templates:write` key scoped to `remote-tests-branch` and `prompt-studio-preview-branch`. Configure the runner key to launch both branch families. Both keys stay on the Prompt Studio host.
