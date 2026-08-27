# Host storage and workspace APIs

## Keep harness state

Use `ctx.state` for host-wide values that a harness must keep between calls:

```ts
const url = await ctx.state.get<string>("serverUrl");
await ctx.state.set("serverUrl", startedUrl);
await ctx.state.delete("serverUrl");
```

The host scopes values to the extension and the active `PSTDIO_HOME`. Project data belongs in command `ctx.storage` instead.

## Remove a worktree

Use `ctx.workspaces.removeWorktree(id)` to free the worktree and branch while keeping the workspace and its sessions. The host updates the workspace and emits `worktree.removed`.

Use `archive(id)` to stop using a workspace but keep it readable. Use `delete(id)` to remove it completely.

## Resolve the active workspace

Use `ctx.workspaceId` and the workspaces API:

```ts
const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : null;
```

Never parse `.pstdio/config.json`. It is owned by the host.

## Store extension-owned repo files

Declare the tracking policy in `package.json`:

```json
{ "pstdio": { "repoFiles": { "tracked": false } } }
```

Then write paths relative to the allocated directory:

```ts
await ctx.extensionFiles?.writeText("cache/index.json", JSON.stringify(index));
```

The host allocates `.pstdio/ext/<publisher>.<name>/`, rejects path escapes, and adds the gitignore entry on the first write. Use `ctx.packageFiles` to read shipped assets, `ctx.repoFiles` for user-facing repo paths, and `ctx.workspaceFiles` for the active working directory.
