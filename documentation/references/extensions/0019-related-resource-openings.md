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

Side and Bottom use the same selection rules. Automatic openings keep the source route. An open populated panel keeps its selected tab and keyboard focus, including when the page remembers another related resource. Revealing a closed or empty panel selects the related tab; its view may focus its input normally. Tab selection means the content shown in that panel.

| Panel before the automatic opening | Result |
| --- | --- |
| Closed, with no remembered manual closure for this resource page | Open the panel and select the related tab. Its previously selected tab stays open if the preview rules allow it. |
| Open with a selected tab | Keep that selection and open the related tab in the background. If it replaces the selected preview, show the replacement in that preview's slot. |
| Open and empty | Show the related tab as the panel's only selection. |

An already open target keeps its actual tray and pin state, even when the owner requests another tray. Reveal and select it if its actual Side or Bottom panel was closed; keep the current selection if that panel was already open. Do not create a duplicate tab or give that existing tab a new automatic lifetime.

For example, with preview A selected beside pinned tab B, automatically opening preview C replaces A and keeps C selected. If B was selected instead, B stays selected and C opens behind it. Both cases preserve the initiating page and keyboard focus.

New previews replace the eligible preview in their requested tray and stay leftmost. Each tray has at most one unpinned tab. Pinned tabs stay open. The initiating source preview is protected. Results apply in order: once a closed panel has been revealed, later entries use its open-panel rule. Several new previews in one tray replace each other, leaving the last eligible preview. Owners can also request Main without navigating away from the source.

Dragging and dropping an unpinned tab pins it, including a reorder within the same tray or a drop into an empty tray. The destination's existing preview stays open and leftmost. The moved tab uses the requested insertion position among pinned tabs. Moving through a tab's menu follows the same rule. Feedback shows the insertion marker and rounded tray outline. Cancelling a drag leaves the tab unpinned. A moved automatic preview is now a kept pinned tab, so source-page cleanup does not close it.

Only page-owned slots bind to the current resource page. Shell and mode placements own their resource content independently. Opening a shared tab while viewing a resource does not make that page its owner. The tab stays visible when moved into Main on Start or another supported page.

## Panel policy and remembered choices

Tab placement, tab selection and panel visibility are separate. These rules apply to every resource owner and related resource, equally in Side and Bottom. They do not depend on Ticket, Session or Workspace types.

1. Page entry places the owner's automatic related tab whether its panel is open or closed. A remembered manual closure hides the panel; it never suppresses the tab's placement or update.
2. Each tray has one replaceable unpinned tab, always leftmost. Replacing its content also replaces its selected content when that preview was selected. Pins remain open.
3. An open populated panel keeps its selected tab and keyboard focus. A newly revealed or empty panel selects the related tab. Remembering a resource chooses which related tab to place; it does not override another selected tab.
4. Closing the last tab closes its panel. Manually closing the last tab also remembers that panel as closed for this resource page.
5. Side and Bottom visibility, sizes, selection and kept tabs are shared only within the current project and mode. Each mode has its own saved state. Page-owned panels are the following temporary overrides.

| Event | Visibility |
| --- | --- |
| Enter a page with an automatic tab for a closed panel | Open it and select the related tab, unless this resource page has a remembered manual closure. |
| Enter a page whose panel was manually closed on a previous visit | Place or update the related tab while keeping its panel closed. |
| Leave a page that automatically revealed a closed panel | Close that panel. Keep any pre-existing tabs in it. |
| Leave a page whose panel was already open | Keep it open, unless closing its last automatic tab makes it empty. |
| Pin the related tab, move it, add a manual tab, replace a resource manually, or explicitly reopen the panel | Keep the user's panel state and pinned tabs when leaving. Any tab still unpinned closes on page navigation. |
| Close a panel on another page | Change visibility within the current mode. Do not record a closure for the resource page that is being revisited. Its own automatic-opening rule may reveal it. |

Only destinations in the current owner's automatic results have resource-page choices. The page remembers the last resource chosen in that destination and explicit visibility changes. Closing its final tab retains the last resource choice, so the next visit can place that preview hidden. Manually reopening the panel clears its closed override. Choosing an older session on a Ticket changes its next session preview; an existing selected pin can still remain in front.

If a page has no automatic opening for Bottom, manually opening a terminal there does not give it a Bottom preference. Open a terminal on Workspace, leave for Tickets, close Bottom, and return: Bottom stays closed. Workspace returns only its latest session in Side. Terminals open manually. Old saved choices for destinations no longer returned by the owner are ignored.

Choices use existing user preference storage and belong to the qualified resource page, including project and owner. They survive reloads. **Reset layout** clears the current page's choices. **Open related resources** disables automatic placement without deleting choices. There is no customization editor or new extension API.

Automatic placement, reveal, cleanup, metadata refresh and extension teardown do not create manual preferences. When edits happen during a pending owner lookup, only edits for its returned automatic destinations become page choices. Navigation, project changes, disablement and owner removal invalidate stale results. Layout reconciliation and ordinary tab selection do not cancel a valid page-entry placement.

## Navigation and cleanup

Navigating to a different page or resource within the same mode closes **all unpinned tabs in every tray**, including Main. This covers automatic, pre-existing, manually opened, reopened and repurposed previews. Pinned tabs remain. Selecting a tab, refreshing metadata, changing a document position, or reselecting the same page does not count as leaving it. Dragging a preview pins it, so it remains. Closing the last tab closes its panel.

Panel visibility has its own lifetime. The visit owns a panel only if it changed that panel from closed to open automatically. Leaving restores it to closed, even if older tabs remain. Explicit tab or visibility edits hand the panel back to the user's layout in this mode. Adding a related tab to an already open panel does not take ownership of its visibility.

Switching modes suspends the outgoing mode instead of applying page-leave cleanup. Hide its tabs and panels while preserving their pin state, selected tabs, visibility, sizes and running terminals. A mode with no panels shows none. Returning to a mode restores it as left, including unpinned tabs and manually closed panels; it does not replay automatic defaults over the saved selection. A later page change within that mode closes its previews. Each project and mode is independent. Pinned manual terminals remain across page navigation within their mode. Closing a terminal tab ends its process.

Saved-route boot places current related previews too, respecting remembered closures and global selection. It does not reveal a panel that this resource page remembers as manually closed. Restoring the same layout or refreshing metadata does not independently evaluate the owner again. Kinds without a command open nothing automatically. Manual links and normal target resolvers remain available.

## Latest sessions

`ctx.sessions.query({ orderBy: "lastActivity" })` orders by the latest run start, run end, update, or creation timestamp, with session ID descending to break ties. The default remains creation-time order.

Pass the source's full `ResourceRef` as `anchor` to filter by owner, kind, ID, and project. Use `limit: 1` to select the most recent matching session.

The API is additive. Follow [API versioning](0014-api-versioning.md) and publish SDK support before independently released extensions adopt it.
