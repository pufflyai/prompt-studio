# Move to remote execution

Change an extension so its agent sessions can run on another machine, while credentials stay in the Prompt Studio host.

Read [Local and remote work](../concepts/0004-local-and-remote.md) first. The [extension API](../../references/extensions/0001-api.md) covers the connection, workspace provider, and harness contracts. The [remote execution design](../../references/architecture/0016-remote-execution-and-automation.md) has the full rules for retries, cancellation, and cleanup.

For installation, connection setup, and launching remote sessions, see the
[Remote Workspaces extension](../../../extensions/remote-workspaces/README.md).

## Steps

1. Declare a named connection with the exact HTTP methods and path prefixes it needs. Add a fixed health-check path when the service has one.
2. Move credentials out of extension settings, environment variables, repository files, webviews, and child processes. People enter them in the extension's **Connections** settings instead.
3. Return a versioned `providerRef` from the workspace provider. It must not contain secrets. Set `executionKind` to `remote`. Do not create a placeholder local path.
4. Make the harness read `input.workspace.executionTarget`. Set `cwdRequirement` to `optional` only after start, resume, reattach, follow-up, and message reads all work without a local working directory.
5. Implement the provider's `resolve` and the harness's `reattach` before you rely on recovery after a restart.
6. Mark only safe public commands with `automation: true`. Keep their input and result small and free of credentials.
7. Callers use machine tokens limited to one project and the exact commands they need. Each outside request needs a stable idempotency key, so a retry does not start the same work twice.
8. Test local harnesses, recovery after a restart, cancellation, duplicate requests, refused scopes, and result size limits. Use a fake test credential and check that it never appears in logs, settings, or command output.

Do not replace the named connection with `ctx.process`, direct requests from a webview, or a general way to read secrets. Those paths move credentials outside the host.
