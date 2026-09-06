import type { ControlParam } from "../extension-kernel";

/** Every supported wire control participates in runtime and compiler validation. */
export const supportedControls = {
  number: { id: "count", name: "Count", type: "number", defaultValue: 2 },
  boolean: { id: "enabled", name: "Enabled", type: "boolean", defaultValue: true },
  text: { id: "title", name: "Title", type: "text", defaultValue: "Notes" },
  markdown: { id: "body", name: "Body", type: "markdown", defaultValue: "# Notes" },
  selection: {
    id: "status",
    name: "Status",
    type: "selection",
    defaultValue: "new",
    options: [{ id: "new", name: "New" }],
  },
  date: { id: "due", name: "Due", type: "date", defaultValue: "2026-09-06" },
  color: { id: "color", name: "Color", type: "color", defaultValue: "#336699" },
  readOnly: {
    id: "summary",
    name: "Summary",
    type: "readOnly",
    value: { type: "image", src: "/image.png", alt: "Preview" },
  },
  resource: {
    id: "note",
    name: "Note",
    type: "resource",
    defaultValue: "one",
    options: [{ id: "one", name: "One", ref: { type: "note", id: "one", extensionId: "acme.notes" } }],
  },
  range: { id: "range", name: "Range", type: "range", defaultValue: [0, 10], min: 0, max: 20 },
  segmented: {
    id: "view",
    name: "View",
    type: "segmented",
    defaultValue: "list",
    options: [{ id: "list", name: "List" }],
  },
  actions: { id: "action", name: "Action", type: "actions", options: [{ id: "save", name: "Save" }] },
  anchorGrid: { id: "anchor", name: "Anchor", type: "anchorGrid", defaultValue: "center" },
  vector: { id: "position", name: "Position", type: "vector", defaultValue: { x: 0, y: 1 } },
} satisfies { [Kind in ControlParam["type"]]: Extract<ControlParam, { type: Kind }> };
