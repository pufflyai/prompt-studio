# Migrate an extension to remote execution

Use the reference in `examples/remote-execution-extension` as the starting point.

1. Declare a named connection with exact methods and path prefixes. Add a fixed health-check path when the service supports one.
2. Move credentials out of extension settings, environment variables, repository files, webviews, and subprocesses. Configure them through the extension's Connections settings.
3. Return a versioned, non-secret `providerRef` from the workspace provider. Set `executionKind` to `remote`; do not create a dummy local path.
4. Make the harness use `input.workspace.executionTarget`. Set `cwdRequirement` to `optional` only after every start, resume, reattach, follow-up, and message path works without `cwd`.
5. Implement provider `resolve` and harness `reattach` before enabling restart recovery.
6. Mark only safe public commands with `automation: true`. Keep their input and result small and free of credentials.
7. Issue project- and command-scoped machine tokens. Require a stable idempotency key for each external intent.
8. Test local harnesses, remote restart recovery, cancellation, credential canaries, duplicate requests, denied scopes, and result limits.

Do not replace the named connection with `ctx.process`, direct webview requests, or a general secret getter. Those paths move credentials outside the host boundary.
