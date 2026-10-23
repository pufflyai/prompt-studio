# Marmalade

Marmalade is a small layered editor that tests the public extension API with five views of one document.

## Edit the sample

Open **Examples → Marmalade**. The Great Wave document opens with canvas, properties and layers, tool rail, navigation, and status webviews.

- Select a layer on the canvas or in Layers. Use Ctrl/Cmd-click to toggle several rows, or Shift-click and Shift+Up/Down to select a range of visible enabled rows.
- Use Move to drag a layer. Arrow keys move a focused canvas layer by one document pixel; Shift moves ten. Edit X, Y, opacity, and text in Properties.
- Use the eye and lock buttons without changing selection. A group's visibility, opacity, and lock affect its children. Locked layers stay selectable and readable.
- Expand a group with its chevron or Left/Right keys. Clicking the row selects the group.
- Drag near a row's top or bottom edge to move before or after it. Drag to the center of a group to move inside it. Alt+Up/Down moves selected sibling layers together. Groups carry their descendants, once each. A move rejects locked or unavailable layers and cycles.
- Use Hand to pan, Zoom to enlarge, Alt-click with Zoom to reduce, and Fit to restore the view. Text selects an existing text layer for editing in Properties.
- New clears the sample document. Restore sample brings it back. Document edits survive reopening.

The sample includes paired image/mask previews and an unavailable reference row. The mask preview represents a full-image mask; this example does not edit masks. This example focuses on layer composition, transforms, and shared outliner interactions.

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
```

The action union in [marmalade.types.ts](../src/apps/marmalade/marmalade.types.ts) also defines transforms, opacity, locks, expansion, tools, viewport changes, empty, and reset.

## State ownership

The extension owns its document, selected IDs, order, groups, expansion, visibility, locks, tools, and viewport. It saves these in one project-scoped storage record. The edit command serializes changes on the host and validates each action against the latest saved document, so separate views do not save stale copies over each other. A rejected action leaves the saved state intact.

Each webview subscribes to the public `marmalade.changed` event before its first read. Notifications and host-sync reconnects trigger a fresh command read. There is no polling or browser-storage copy. Input drafts, pending selection, and in-progress drags have transient local previews. Saved document state stays on the host. Command failures appear beside the canvas and inspector controls.

`TreeList` owns generic focus, range-selection gestures, explicit insertion feedback, and keyboard move intent. `ListRow` supplies preview slots, persistent toggle actions, and separate expansion controls. The example supplies image rendering and lock/group rules. See the **Tree List / Outliner** Storybook stories for a domain-free composition.

## Sample image

The bundled [Great Wave image](../assets/great-wave.jpg) is Katsushika Hokusai's *Under the Wave off Kanagawa*, ca. 1830–32, Metropolitan Museum of Art, accession JP1847, [collection object 45434](https://www.metmuseum.org/art/collection/search/45434). The museum marks it public domain. Its Open Access image is bundled so editing does not require network access.
