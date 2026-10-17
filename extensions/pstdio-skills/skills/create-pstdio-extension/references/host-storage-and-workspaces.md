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

Use `delete(id)` to remove a workspace and its provider-owned resources.

## Resolve the active workspace

Use `ctx.workspaceId` and the workspaces API:

```ts
const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : null;
```

Never parse `.pstdio/config.json`. It is owned by the host.

## Store extension-owned project files

Keep configuration, caches, drafts, prototypes, evidence, and backups under
`.pstdio/extension-storage/<package-name>/`. Declare an artifact mount:

```ts
const cacheFiles = defineArtifactMount({ id: "cache", path: "cache", label: "Cache" });
```

Register it in `artifactMounts`, then write paths relative to it:

```ts
await ctx.artifacts.mount("cache").writeText("index.json", JSON.stringify(index));
```

The host rejects path escapes. Extension source belongs in `.pstdio/extensions/`;
it is not runtime storage. Use `ctx.packageFiles` for shipped assets, `ctx.projectFiles`
for project source files, and `ctx.workspaceFiles` for the active working directory.
