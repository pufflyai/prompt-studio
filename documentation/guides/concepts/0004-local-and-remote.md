# Local and remote work

Prompt Studio keeps the record of work in one place and runs the work where its files are. That can be your computer or another machine.

## Record and run are separate jobs

The Prompt Studio runtime keeps the record. It stores projects, workspaces, sessions, and their history. It decides who may do what, and it tracks each piece of work from start to finish.

The work itself runs where its files are:

- Local work runs as processes on your computer, in a folder you can open.
- Remote work runs on another machine, through a workspace provider and a harness that support it.

Both can be on the same computer, but they stay separate jobs. A process exiting, a request being accepted, and the work being done are three different results.

## Local work

A local workspace is a folder on your computer: the project folder, or a Git worktree. Agents run as local processes with that folder as their working directory. File browsing, terminals, diffs, and merges all act on that folder.

## Remote work

A remote workspace lives on another machine. An extension provides it: the extension creates the environment there and keeps a reference to it. Prompt Studio stores only that reference, never a local path.

- Your local files are not uploaded or synced. The provider supplies its own source code and tools.
- A remote workspace never falls back to your project folder.
- Actions the provider does not support, such as a local terminal, are not offered.
- A harness that supports remote work runs the agent there and streams the conversation back.

The [Remote Workspaces](../../../extensions/remote-workspaces/README.md) extension is one example. It runs sessions in PocketCoder workspaces on another computer.

## Credentials stay in the host

An extension reaches a remote service through a named connection. The connection declares which HTTP methods and paths the extension may call. The project settings store only the service address and a reference to the secret. The secret itself stays in Prompt Studio's secret store.

The extension never reads the secret. It sends requests through the host, and the host refuses requests the connection does not allow. Set up connections in the extension's **Connections** settings.

## Start work from other systems

Another system, such as a webhook or a scheduler, can start work in a project. Issue it a machine token in **Settings → Machine tokens**, or with `pst auth tokens`. A token works for one project, only for the commands you list, and only until it expires. A command must be marked for automation before a token can run it.

Each request carries an idempotency key, a unique name for that request. Sending the same key twice returns the existing run instead of starting a second one. Accepted runs are saved, so queued work starts again after a restart.

## Learn more

- [Remote automation commands](../../references/cli/0007-automation.md)
- [Durable work](../../references/extensions/0007-durable-automation.md)
- [Move an extension to remote execution](../extensions/0004-remote-execution-migration.md)
