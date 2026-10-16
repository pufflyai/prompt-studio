# Related resource openings

A resource owner can choose which related resources open with it, their trays, and whether their tabs stay unpinned.

## Declare the owner command

Set `relatedOpenings` on `defineResourceKind` to a command of the same extension. The host invokes it with the source in `ctx.resource` and the current project context.

```ts
interface RelatedResourceOpening {
  readonly resource: ResourceRef;
  readonly autoOpen?: boolean;
  readonly region: ExtensionPanelRegion;
  readonly open?: PageOpenIntent;
}

type RelatedResourceOpenings = readonly RelatedResourceOpening[];
```

Return an array, or `[]` when nothing should open. Only `autoOpen: true` opens a target automatically. False and omission leave it closed. `open` independently chooses `preview` (the default) or `pin`. Regions are `main`, `secondary` (Bottom), and `side`.

```ts
import {
  defineCommand,
  defineExtension,
  defineResourceKind,
  type RelatedResourceOpenings,
} from "@pstdio/sdk/extensions";

const related = defineCommand({
  id: "related",
  title: "Select related resources",
  async run(ctx) {
    if (!ctx.resource) return [];
    const { items } = await ctx.sessions.query({
      anchor: ctx.resource,
      orderBy: "lastActivity",
      limit: 1,
    });
    const session = items[0];
    return session ? [{
      resource: {
        type: "session",
        id: session.id,
        extensionId: "pstdio",
        projectId: ctx.project.id,
        label: session.title,
      },
      autoOpen: true,
      region: "side",
      open: "preview",
    }] satisfies RelatedResourceOpenings : [];
  },
});
const ticket = defineResourceKind({ id: "ticket", relatedOpenings: related.ref });
export default defineExtension({ commands: [related], resourceKinds: [ticket] });
```

One command can return several targets. Workspace's owner returns its terminal in Bottom and its latest session in Side. Owners select candidates using their domain data. Selection commands must not navigate or create sessions.

## Presentation and retention

Targets use their normal resource-owner resolver. A source does not need to know the target extension's view implementation. Resource and command references without an extension ID use the defining owner; omitted project IDs use the current project.

An already open target keeps its tray and pin state. New previews replace the eligible preview in their requested tray and stay leftmost. Each tray has at most one preview. Results apply in order, so the last eligible preview for a tray remains. The initiating source preview is protected.

Automatic openings keep the source route, global focus, and the selected tab in each populated tray. A new related tab opens in the background; if it replaces the selected preview, it takes that preview's place. They do not recursively open more resources.

Leaving the source page closes every unpinned tab newly opened automatically for that page, including tabs sharing a tray with pinned tabs. Tabs already open before entry stay open. Pinning a tab, manually reopening it, or replacing its resource releases it from page cleanup. Selecting a related tab or refreshing its metadata keeps its page lifetime. Closing the last tab in Side or Bottom also closes that panel.

Source or project changes, disabling the existing Open related resources switch, and owner removal discard pending results. Restoring layout and refreshing resource metadata do not reopen closed related tabs.

Kinds without a command open nothing automatically. Existing manual links still work. Returning an entry does not store a relationship or add a manual action. There is no per-kind customization UI or new preference store.

## Latest sessions

`ctx.sessions.query({ orderBy: "lastActivity" })` orders by the latest run start, run end, update, or creation timestamp, with session ID descending to break ties. The default remains creation-time order.

Pass the source's full `ResourceRef` as `anchor` to filter by owner, kind, ID, and project. Use `limit: 1` to select the most recent matching session.

The API is additive. Follow [API versioning](0014-api-versioning.md) and publish SDK support before independently released extensions adopt it.
