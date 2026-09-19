# Extension API alpha.11 migration

- Replace returned navigation targets with `ctx.navigation.open(target)`. Return ordinary command data.
- Table and kanban `onRowActivate` callbacks now return void and use the same context method.
- Keep direct webview `host.call("navigation.open", { target })`. The host applies navigation from webview command responses; guests must not replay it.
- Replace `{ id, deleted: true }` UI conventions with `await ctx.resources.removed({ type, id })` immediately after committed deletion. The result can still contain application data.
- Declare the removed resource kind in the deleting extension. Reports are scoped by extension, project, type, and ID; qualify foreign resource references explicitly when navigating.
- Use `ArtifactMount.updateText` for existing documents. It fails when the file is missing and never recreates a concurrently removed file. Keep `writeText` for creation.
- Use `storage.collection(name).update(id, value)` for editor saves to stored items. It atomically replaces an existing item and throws if deletion won the race; `put` still creates or replaces items.

Navigation is local to a successful initiating UI invocation. Removal is a shared data fact delivered through sync even if later command work fails. Hooks and headless commands do not navigate. Live removal is not durable recovery: missing-resource loads remain required after disconnects or restoration.
