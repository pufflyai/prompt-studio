# Marmalade

Marmalade is a small layered editor that uses a native action bar beside isolated views of one document.

## Edit the sample

Open **Examples → Marmalade**. The Great Wave document opens with canvas, properties and layers, navigation, and status webviews. The host renders the tool rail, so labels and menus remain visible beside its narrow edge.

Use **Document actions** at the end of the tool rail for Undo, Redo, Duplicate selection, New document, Restore sample, and Export SVG. Unavailable actions stay disabled. Arrow keys, Home, and End move through the rail. Escape or clicking the trigger again closes its menu. Tooltips and menu rows use shared shortcut hints.

- Select a layer on the canvas or in Layers. Use Ctrl/Cmd-click to toggle several rows, or Shift-click and Shift+Up/Down to select a range of visible enabled rows.
- Use Move to drag selected layers. Arrow keys move focused layers by one document pixel; Shift moves ten. Edit name, X/Y, dimensions, rotation, and opacity in Properties.
- Click with Text to create editable type, or select existing type. Change text, font family, size, weight, alignment, and color in Properties.
- Drag with Rectangle or Ellipse to add a shape. Draw with Brush to add a stroke, then change its color and width in Properties. Each shape or stroke becomes an editable layer.
- Use the Layers toolbar to duplicate, delete, group, or ungroup a selection. Groups carry their descendants. Grouping requires sibling layers; ungrouping preserves inherited visibility and opacity.
- Select an image to change brightness, contrast, saturation, and blur. Adjustments stay editable and leave the bundled original image unchanged. Reset adjustments restores neutral values.
- Use the eye and lock buttons without changing selection. A group's visibility, opacity, and lock affect its children. Locked layers stay selectable and readable.
- Expand a group with its chevron or Left/Right keys. Clicking the row selects the group.
- Drag near a row's top or bottom edge to move before or after it. Drag to the center of a group to move inside it. Alt+Up/Down moves selected sibling layers together. Groups carry their descendants, once each. A move rejects locked or unavailable layers and cycles.
- Use Hand to pan, Zoom to enlarge, Alt-click with Zoom to reduce, and Fit to restore the view.
- Undo and Redo restore document edits across all views, including after reopening. The last 20 edits are retained. Selecting layers, changing tools, expanding groups, and panning or zooming do not consume history.
- New clears the sample document. Restore sample brings it back. Document edits survive reopening.

The sample includes paired image/mask previews and an unavailable reference row. The mask preview represents a full-image mask; this example does not edit masks. Brush strokes are vector paths. PSD files, raster retouching, and advanced masks are outside this example.

Use the shared shortcut mode (Alt+Shift+Space), then **Current view** (A), followed by V, T, R, E, B, H, or Z to select tools. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes; Ctrl/Cmd+D duplicates; Ctrl/Cmd+G groups; Ctrl/Cmd+Shift+G ungroups; Delete removes selected layers. Text fields and IME keep their normal editing shortcuts. Menus and modals keep keyboard ownership.

Properties and Layers have fixed headers and separate scroll areas. Drag their separator or focus it and use the arrow keys to resize. The host saves the completed size as a project view preference, separate from the document and undo history. The surrounding Side panel still resizes independently.

Numeric properties preview immediately in all views. Enter or leaving the input completes one edit; Escape cancels. The opacity slider previews during a drag and completes one edit on release; Escape or pointer cancellation discards its preview. Leaving the editor cancels unfinished pointer gestures even when the host retains its views. Valid typed properties complete on defocus. Invalid and empty numbers remain visible for correction without writing a document edit. A mixed selection shows **Mixed** for differing opacity or blend modes. Each edit applies to the selection in one undo step. Opacity works on both groups and individual layers. Blend mode is read-only whenever the selection includes a group. Locked selections remain readable.

## Export SVG

Choose **Document actions → Export SVG**. The Great Wave sample exports as
`great-wave.svg` with media type `image/svg+xml`. The file embeds its original
image and preserves visible layers, text, shapes, strokes, transforms, opacity,
blend modes, and image adjustments. Hidden or unavailable layers, selection
outlines, and the editor's zoom and pan are excluded.

The canvas finishes pending edits before exporting the saved document through
the public `marmalade.export` command. That command reads only this extension's
current project storage and packaged image. It returns `fileName`, `mimeType`,
and UTF-8 SVG content; a server path is never treated as a delivered file:

```sh
pst pstdio.extension-lab marmalade export --document-id great-wave
```

The native action sends those bytes to the public `client.files.save` capability.
Desktop opens Save as and reports a completed write or cancellation. A browser
reports **Download started**; its download UI owns later completion and
cancellation. Recoverable failures appear over the canvas beside the action
area, with **Retry** and a dismiss control. Retrying rereads the current document.
Switching documents or projects removes the old action and prevents a delayed
read from starting a stale export.

This requires the outcome-aware save and native resource-action menu additions
in a supporting host and published SDK. The independently released consumer
must pin that SDK before release; a local development link is not publication
evidence. See [webview files](../../../documentation/references/extensions/0005-webview-and-storage-api.md#webview-files)
for the platform's delivery semantics.

## Use the same commands from an agent

Read the current document:

```sh
pst extension-lab marmalade read
```

Edit a layer through the same command that the webviews call:

```sh
pst extension-lab marmalade edit --action '{"type":"text","id":"title","text":"Ocean study"}'
pst extension-lab marmalade edit --action '{"type":"visibility","id":"artwork","visible":false}'
pst extension-lab marmalade edit --action '{"type":"select","ids":["title","credit"]}'
pst extension-lab marmalade edit --action '{"type":"reorder","source":"title","target":"artwork","position":"before"}'
pst extension-lab marmalade edit --action '{"type":"create","kind":"ellipse","x":100,"y":100,"width":240,"height":180,"color":"#f4b860"}'
pst extension-lab marmalade edit --action '{"type":"properties","id":"title","changes":{"fontSize":64,"rotation":10,"color":"#ffffff"}}'
pst extension-lab marmalade edit --action '{"type":"adjustments","id":"artwork","changes":{"saturation":0,"contrast":120}}'
pst extension-lab marmalade edit --action '{"type":"selection-properties","ids":["title","credit"],"changes":{"opacity":0.8,"blendMode":"multiply"}}'
pst extension-lab marmalade edit --action '{"type":"undo"}'
```

The action union in [marmalade.types.ts](../src/apps/marmalade/marmalade.types.ts) also defines duplicate, delete, group, ungroup, redo, transforms, opacity, locks, expansion, tools, viewport changes, empty, and reset. A read returns layer IDs and the available undo and redo counts.

## State ownership

The extension owns its document, selected IDs, order, groups, expansion, visibility, locks, tools, and viewport. It saves these in a project-scoped storage record. History lives in a second record, updated atomically with the document. Reads return history counts rather than duplicating the snapshots in each webview. The edit command serializes changes on the host and validates each action against the latest saved document, so separate views do not save stale copies over each other. A rejected action leaves the document and history intact.

The public command editing session owns the shared document, previews and pending commands. It subscribes to `marmalade.changed` and refreshes after external changes. Older acknowledgements cannot clear newer edits. Failed commands retain intent and show inline **Retry** in the canvas and inspector. Retry uses the same accepted operation identity. Normal saving stays silent. Closing a view leaves accepted commands with their host owner; changing projects binds a separate owner. There is no polling or browser-storage copy.

For this inspector composition, use `ResizableSplitLayout` with a bottom panel, sensible minimum sizes and `collapsible={false}`. Put each group's header outside its own shrinking `ScrollArea`. Save completed `onSizeChange` values through `client.preferences`; do not dispatch a document action. See [numeric editing callbacks](../../../documentation/guides/extensions/0012-numeric-property-editing.md) for the shared control contract (RB 4.A.7 and RB 6.A.13).

`TreeList` owns generic focus, range-selection gestures, explicit insertion feedback, and keyboard move intent. `ListRow` supplies preview slots, persistent toggle actions, and separate expansion controls. The example supplies image rendering and lock/group rules. See the **Tree List / Outliner** Canvas stories for a domain-free composition.

## Sample image

The bundled [Great Wave image](../assets/great-wave.jpg) is Katsushika Hokusai's *Under the Wave off Kanagawa*, ca. 1830–32, Metropolitan Museum of Art, accession JP1847, [collection object 45434](https://www.metmuseum.org/art/collection/search/45434). The museum marks it public domain. Its Open Access image is bundled so editing does not require network access.

*Updated at: 2026-11-22*
