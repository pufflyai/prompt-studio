# Storage and workspace APIs

Choose storage by who owns the data. The [extension API index](extension-api.md#storage-results-and-writes) covers result shapes and write rules. The public contracts are [Extension file storage](https://prompt.studio/docs/guides/extensions/extension-storage/) and [Artifact mounts and storage](https://prompt.studio/docs/references/extensions/webview-and-storage-api/#artifact-mounts-and-storage).

| Data | API |
| --- | --- |
| Structured project data, such as a list of bookmarks | `ctx.storage` (collections on every host, `ctx.storage.records` from API 0.2.0) |
| Files the extension owns in the project | `ctx.extensionFiles` or a declared artifact mount |
| Files shipped inside the extension package | `ctx.packageFiles` (read-only) |
| Project source files | `ctx.projectFiles` |
| Files of the workspace the command runs in | `ctx.workspaceFiles` |
| Host-wide values a harness keeps between calls | `ctx.state` in harness handlers |

`ctx.projectFiles`, `ctx.workspaceFiles`, and `ctx.extensionFiles` are optional. They are missing when the context has no ready workspace with file access. Check before use and return a clear error.

## Keep harness state

Harness handlers receive `ctx.state`, scoped to the extension and the host's `PSTDIO_HOME`:

```ts
const url = await ctx.state.get<string>("serverUrl");
await ctx.state.set("serverUrl", startedUrl);
await ctx.state.delete("serverUrl");
```

Project data belongs in `ctx.storage` instead.

## Store extension-owned project files

Keep configuration, caches, drafts, prototypes, evidence, and backups under `.pstdio/extension-storage/<package-name>/`. Never create another data folder directly under `.pstdio/`, and never write runtime data into extension source folders.

Declare an artifact mount when a view needs to read the files or react to changes:

```ts
const cacheFiles = defineArtifactMount({ id: "cache", path: "cache", label: "Cache" });
```

Register it in `artifactMounts`, then use paths relative to it:

```ts
await ctx.artifacts.mount("cache").writeText("index.json", JSON.stringify(index));
```

`ctx.extensionFiles` is the extension's allocated folder. Its location changed in API 0.2.0, so only use relative paths with it. A mount path cannot start with `.publishers`. The host rejects paths that escape the mount.

## Workspaces

A workspace is where sessions run. Every project has a default workspace; other workspaces come from providers such as Git worktrees or remote environments.

Resolve the workspace a command runs in with `ctx.workspaceId`:

```ts
const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : null;
```

Never parse `.pstdio/config.json`. The host owns it.

To end work in a workspace:

- `ctx.workspaces.removeWorktree(id)` frees a Git worktree and its branch but keeps the workspace record and its sessions. The host emits `worktree.removed`.
- `ctx.workspaces.delete(id)` asks the provider to clean up and removes the workspace. For a Git worktree this also discards uncommitted changes.
- `ctx.workspaces.archive(id)` is a deprecated name for `delete(id)`. It deletes the workspace; it does not keep it readable. Do not use it in new code.

See [Workspaces](https://prompt.studio/docs/references/cli/workspaces/) and [Projects and workspaces](https://prompt.studio/docs/guides/concepts/projects-and-workspaces/).
