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

## Opening and tab selection

Targets use their normal resource-owner resolver. A source does not need to know the target extension's view implementation. Resource and command references without an extension ID use the defining owner; omitted project IDs use the current project.

An explicit resource open or selection evaluates its owner's command once when **Open related resources** is enabled in Appearance settings. The setting is on by default. Automatic targets do not run their own related-opening commands, so openings do not recurse.

Side and Bottom use the same selection rules. Automatic openings keep the source route. In an open populated panel they preserve its selected tab and keyboard focus. Revealing a closed or empty panel selects the related tab; its view may focus its input normally. Tab selection means the content shown in that panel.

| Panel before the automatic opening | Result |
| --- | --- |
| Closed, including a panel with saved tabs | Open the panel and select the related tab. Its previously selected tab stays open if the preview rules allow it. |
| Open with a selected tab | Keep that selection and open the related tab in the background. If it replaces the selected preview, show the replacement in that preview's slot. |
| Open and empty | Show the related tab as the panel's only selection. |

An already open target keeps its actual tray and pin state, even when the owner requests another tray. Reveal and select it if its actual Side or Bottom panel was closed; keep the current selection if that panel was already open. Do not create a duplicate tab or give that existing tab a new automatic lifetime.

New previews replace the eligible preview in their requested tray and stay leftmost. Each tray has at most one unpinned tab. Pinned tabs stay open. The initiating source preview is protected. Results apply in order: once a closed panel has been revealed, later entries use its open-panel rule. Several new previews in one tray replace each other, leaving the last eligible preview. Owners can also request Main without navigating away from the source.

## Navigation and cleanup

Leaving the source page closes every unpinned tab newly opened automatically for that page, including tabs sharing a tray with pinned tabs. The following rules apply equally to Side and Bottom.

| Tab or panel state | On source page leave |
| --- | --- |
| New automatic unpinned tab | Close it. Selecting it or refreshing its title or metadata does not change this lifetime. |
| Tab already present before entry | Keep it, including an existing unpinned target. |
| Automatic tab the user pinned | Keep it. |
| Tab manually opened or reopened, or whose resource the user replaced | Keep it. It no longer belongs to automatic page cleanup. |
| Manually opened empty panel | Keep it open. |
| Last tab is closed, manually or by page cleanup | Close that Side or Bottom panel too. |

In the dashboard, manual Side and Bottom panels and tabs follow the project across page and mode navigation and browser history. This includes terminals added through the panel menu: leaving Workspace for Ticket or Tickets keeps the tab and the same running terminal process. Closing the terminal tab ends that process. Each mode still controls which regions it supports. Panel state does not carry into another project.

Automatic page ownership survives saved-layout restoration. Restoring layout and refreshing resource metadata do not run the owner's command again or reopen closed related tabs. Source or project changes, disabling **Open related resources**, and owner removal discard pending results.

Kinds without a command open nothing automatically. Existing manual links still work. Returning an entry does not store a relationship or add a manual action. There is no per-kind customization UI or new preference store.

## Latest sessions

`ctx.sessions.query({ orderBy: "lastActivity" })` orders by the latest run start, run end, update, or creation timestamp, with session ID descending to break ties. The default remains creation-time order.

Pass the source's full `ResourceRef` as `anchor` to filter by owner, kind, ID, and project. Use `limit: 1` to select the most recent matching session.

The API is additive. Follow [API versioning](0014-api-versioning.md) and publish SDK support before independently released extensions adopt it.
