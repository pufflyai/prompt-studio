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

One command can return several targets. Workspace's owner returns its latest session in Side. Terminals open through the normal manual panel controls. Owners select candidates using their domain data. Selection commands must not navigate or create sessions.

## Opening and tab selection

Targets use their normal resource-owner resolver. A source does not need to know the target extension's view implementation. Resource and command references without an extension ID use the defining owner; omitted project IDs use the current project.

An explicit resource open or selection evaluates its owner's command once when **Open related resources** is enabled in Appearance settings. The setting is on by default. Automatic targets do not run their own related-opening commands, so openings do not recurse.

Side and Bottom use the same selection rules. Automatic openings keep the source route. Without a saved page choice, an open populated panel keeps its selected tab and keyboard focus. Revealing a closed or empty panel selects the related tab; its view may focus its input normally. Tab selection means the content shown in that panel.

| Panel before the automatic opening, with no saved page choice | Result |
| --- | --- |
| Closed, including a panel with saved tabs | Open the panel and select the related tab. Its previously selected tab stays open if the preview rules allow it. |
| Open with a selected tab | Keep that selection and open the related tab in the background. If it replaces the selected preview, show the replacement in that preview's slot. |
| Open and empty | Show the related tab as the panel's only selection. |

An already open target keeps its actual tray and pin state, even when the owner requests another tray. Reveal and select it if its actual Side or Bottom panel was closed; keep the current selection if that panel was already open. Do not create a duplicate tab or give that existing tab a new automatic lifetime.

New previews replace the eligible preview in their requested tray and stay leftmost. Each tray has at most one unpinned tab. Pinned tabs stay open. The initiating source preview is protected. Results apply in order: once a closed panel has been revealed, later entries use its open-panel rule. Several new previews in one tray replace each other, leaving the last eligible preview. Owners can also request Main without navigating away from the source.

Dragging and dropping an unpinned tab pins it, including a reorder within the same tray or a drop into an empty tray. The destination's existing preview stays open and leftmost. The moved tab uses the requested insertion position among pinned tabs. Moving through a tab's menu follows the same rule. Feedback shows the insertion marker and rounded tray outline. Cancelling a drag leaves the tab unpinned. A moved automatic preview is now a kept pinned tab, so source-page cleanup does not close it.

## Remembered page choices

Resource pages remember the user's choices only in Side or Bottom destinations returned by their owner's current automatic openings. Other panels use the project's global state. Choosing another session or resource, selecting a different tab, pinning it, or manually opening, closing or hiding a panel updates that page's choice. Returning through navigation or browser history restores the chosen resource and selected tab instead of the owner's default. For example, choosing an older session on a ticket keeps that session selected when returning, even after another page shows a different session.

Closing a tab records the remaining selection, or an empty closed panel when the last tab closes. Hiding the panel records it as closed. Returning to that resource page does not reopen a manually closed panel. Manually reopening it updates the choice again. An explicitly opened empty panel stays open and suppresses that page's automatic default; manually kept project tabs can still carry into it.

If a page has no automatic opening for Bottom, manually opening a terminal there does not give the page its own Bottom preference. Opening it on Workspace, leaving for Tickets, closing Bottom, and returning keeps Bottom closed. The same rule applies to Side when the owner has no automatic Side opening. Old saved choices for destinations no longer returned by the owner are ignored.

Choices belong to the user and the qualified resource page, including its project and resource owner. Changing one resource's choices does not change another's. They use the existing workbench preference storage and survive reloads. There is no settings editor or extension API change. **Reset layout** clears the current page's remembered choices. Turning off **Open related resources** skips related openings without deleting the choices.

Only user edits override the owner's defaults. Automatic preview cleanup, automatic panel reveal, metadata refresh, and extension teardown do not record a new choice. A page with no user changes can still open the owner's latest related resources on a later visit. Manual edits cancel pending presentation so late results cannot undo a closure or selection. If the owner lookup is still pending, only edits for its returned automatic destinations become page preferences; edits to other panels remain global.

## Navigation and cleanup

Leaving the source page closes every unpinned tab newly opened automatically for that page, including tabs sharing a tray with pinned tabs. The following rules apply equally to Side and Bottom.

| Tab or panel state | On source page leave |
| --- | --- |
| New automatic unpinned tab | Close it. Selecting it or refreshing its title or metadata does not change this lifetime. Remembered choices remain available for the next visit. |
| Tab already present before entry | Keep it, including an existing unpinned target. |
| Automatic tab the user pinned | Keep it. |
| Tab manually opened or reopened, or whose resource the user replaced | Keep it. It no longer belongs to automatic page cleanup. |
| Manually opened empty panel | Keep it open. |
| Last tab is closed, manually or by page cleanup | Close that Side or Bottom panel too. |

In the dashboard, manual Side and Bottom panels and tabs follow the project across page and mode navigation and browser history. This includes terminals added through the panel menu: leaving Workspace for Ticket or Tickets keeps the tab and the same running terminal process. Closing the terminal tab ends that process. Each mode still controls which regions it supports. Panel state does not carry into another project.

Automatic page ownership survives saved-layout restoration. Restoring layout does not replay automatic openings or change the restored selection. Saved-route boot reads the current owner's destinations so later user edits can be classified, without opening related tabs. Refreshing resource metadata does not reopen closed related tabs. Source or project changes, disabling **Open related resources**, and owner removal discard pending results.

Kinds without a command open nothing automatically. Existing manual links still work. Returning an entry does not store a relationship or add a manual action. There is no per-kind customization UI or new preference store.

## Latest sessions

`ctx.sessions.query({ orderBy: "lastActivity" })` orders by the latest run start, run end, update, or creation timestamp, with session ID descending to break ties. The default remains creation-time order.

Pass the source's full `ResourceRef` as `anchor` to filter by owner, kind, ID, and project. Use `limit: 1` to select the most recent matching session.

The API is additive. Follow [API versioning](0014-api-versioning.md) and publish SDK support before independently released extensions adopt it.
