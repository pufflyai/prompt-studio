import { expect, test } from "bun:test";
import { Circle, Monitor } from "lucide-react";
import { flattenKanbanRendererListItems } from "./kanban-renderer-list";
import { buildResourceListItems, countResourceListRows, resourceListSettings } from "./resource-list-view-model";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "device",
    label: "Device",
    type: {
      kind: "enum",
      options: [
        { value: "local", label: "This device", icon: "monitor", color: "green", note: "Online", canCreate: true },
        { value: "remote", label: "Build box", color: "gray", note: "Offline" },
      ],
    },
  },
];
const rows: KanbanRendererRow[] = [
  { id: "b", title: "Beta", attributes: { device: "remote" } },
  {
    id: "a",
    title: "Alpha",
    icon: "folder",
    attributes: { device: "local" },
    children: [
      { id: "child", title: "Session", attributes: {}, children: [{ id: "deep", title: "Message", attributes: {} }] },
    ],
  },
];
const build = (settings = resourceListSettings({ columnGrouping: "device" })) =>
  buildResourceListItems({
    rows,
    attributes,
    settings,
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "",
    onCreate: () => {},
  });

test("group labels, counts, notes, colors and optional creation come from extension values", () => {
  const items = build();
  expect(
    items.map((item) => [item.title, item.countBadge, item.note, item.statusColorPalette, Boolean(item.onCreate)]),
  ).toEqual([
    ["This device", 1, "Online", "green", true],
    ["Build box", 1, "Offline", "gray", false],
  ]);
  expect(items.every((item) => !item.onDropRow)).toBe(true);
});

test("group headers show the declared device icon and retain the default for unspecified icons", () => {
  const items = build();
  expect(items[0].statusIcon).toBe(Monitor);
  expect(items[1].statusIcon).toBe(Circle);
});

test("group context menus invoke the declared device action", async () => {
  let opened = false;
  const source = structuredClone(attributes);
  if (source[0].type.kind !== "enum" || !Array.isArray(source[0].type.options)) throw new Error("Expected enum");
  source[0].type.options[0].contextMenuActions = [
    {
      id: "details",
      label: "This device",
      onAction: () => {
        opened = true;
      },
    },
  ];
  const items = buildResourceListItems({
    rows,
    attributes: source,
    settings: resourceListSettings({ columnGrouping: "device" }),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "",
  });
  const details = items[0].contextMenuActions?.find((action) => action.key === "details");
  expect(details?.label).toBe("This device");
  await details?.onClick?.();
  expect(opened).toBe(true);
});

test("children nest at every level and collapse independently from their group", () => {
  const items = build();
  expect(flattenKanbanRendererListItems(items, {}).map((row) => [row.item.title, row.depth])).toEqual([
    ["This device", 0],
    ["Alpha", 1],
    ["Session", 2],
    ["Message", 3],
    ["Build box", 0],
    ["Beta", 1],
  ]);
  expect(
    flattenKanbanRendererListItems(items, { [items[0].children![0].id]: false }).map((row) => row.item.title),
  ).not.toContain("Session");
  expect(flattenKanbanRendererListItems(items, { [items[0].id]: false }).map((row) => row.item.title)).not.toContain(
    "Alpha",
  );
});

test("saved display settings hide children, cannot enable a board, and drop sub-groupings without a grouping", () => {
  const settings = resourceListSettings({
    viewMode: "board",
    rowGrouping: "device",
    subGroupings: ["device"],
    showChildren: false,
    columnGrouping: "none",
    displayProperties: ["date"],
  });
  expect(settings).toMatchObject({
    viewMode: "list",
    rowGrouping: "none",
    subGroupings: [],
    displayProperties: ["date"],
  });
  const items = build(settings);
  expect(items.every((item) => !item.children && !item.draggable && !item.onDropRow)).toBe(true);
});

test("sub-groupings keep their order and use each field once", () => {
  expect(
    resourceListSettings({ columnGrouping: "device", subGroupings: ["channel", "device", "severity", "channel"] })
      .subGroupings,
  ).toEqual(["channel", "severity"]);
});

const enumAttribute = (id: string, label: string, options: [string, string][]): AttributeDescriptor => ({
  id,
  label,
  type: { kind: "enum", options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })) },
});
const channel = enumAttribute("channel", "Channel", [
  ["web", "Web shop"],
  ["market", "Marketplace"],
]);
const severity = enumAttribute("severity", "Severity", [
  ["required", "Required"],
  ["recommended", "Recommended"],
]);
const rules: KanbanRendererRow[] = [
  { id: "r1", title: "Title starts with brand", attributes: { device: "local", channel: "web", severity: "required" } },
  { id: "r2", title: "Main image on white", attributes: { device: "local", channel: "web", severity: "recommended" } },
  { id: "r3", title: "GTIN is present", attributes: { device: "local", channel: "market", severity: "required" } },
  { id: "r4", title: "Price has currency", attributes: { device: "remote", channel: "web", severity: "required" } },
];
const buildRules = (subGroupings: string[]) =>
  buildResourceListItems({
    rows: rules,
    attributes: [...attributes, channel, severity],
    settings: resourceListSettings({ columnGrouping: "device", subGroupings }),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "",
    onCreate: () => {},
  });
const outline = (items: ReturnType<typeof buildRules>) =>
  flattenKanbanRendererListItems(items, {}).map((row) => [row.item.title, row.depth, row.item.countBadge]);

test("a sub-grouping nests counted groups inside each group and omits empty ones", () => {
  const items = buildRules(["channel"]);
  expect(outline(items)).toEqual([
    ["This device", 0, 3],
    ["Web shop", 1, 2],
    ["Title starts with brand", 2, undefined],
    ["Main image on white", 2, undefined],
    ["Marketplace", 1, 1],
    ["GTIN is present", 2, undefined],
    ["Build box", 0, 1],
    ["Web shop", 1, 1],
    ["Price has currency", 2, undefined],
  ]);
  expect(countResourceListRows(items)).toBe(4);
  expect(items[0].children!.every((group) => group.isGroup && !group.onCreate)).toBe(true);
});

test("each further sub-grouping nests one level deeper with unique group identities", () => {
  const items = buildRules(["channel", "severity"]);
  expect(outline(items)).toEqual([
    ["This device", 0, 3],
    ["Web shop", 1, 2],
    ["Required", 2, 1],
    ["Title starts with brand", 3, undefined],
    ["Recommended", 2, 1],
    ["Main image on white", 3, undefined],
    ["Marketplace", 1, 1],
    ["Required", 2, 1],
    ["GTIN is present", 3, undefined],
    ["Build box", 0, 1],
    ["Web shop", 1, 1],
    ["Required", 2, 1],
    ["Price has currency", 3, undefined],
  ]);
  expect(countResourceListRows(items)).toBe(4);
  const ids = flattenKanbanRendererListItems(items, {}).map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("view filters, ordering and search narrow the resource list", () => {
  const items = buildResourceListItems({
    rows,
    attributes,
    settings: resourceListSettings({}),
    filter: { conjunction: "and", rules: [] },
    sorts: [{ attributeId: "title", direction: "asc" }],
    search: "",
  });
  expect(items.map((item) => item.title)).toEqual(["Alpha", "Beta"]);
  const searched = buildResourceListItems({
    rows,
    attributes,
    settings: resourceListSettings({}),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "Beta",
  });
  expect(searched.map((item) => item.title)).toEqual(["Beta"]);
});

test("filters retain source groups while groups with no source resources stay absent", () => {
  const items = buildResourceListItems({
    rows,
    attributes,
    settings: resourceListSettings({ columnGrouping: "device" }),
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Alpha" }] },
    sorts: [],
    search: "",
  });
  expect(items.map((item) => [item.title, item.countBadge])).toEqual([
    ["This device", 1],
    ["Build box", 0],
  ]);
  expect(
    buildResourceListItems({
      rows: [],
      attributes,
      settings: resourceListSettings({ columnGrouping: "device" }),
      filter: { conjunction: "and", rules: [] },
      sorts: [],
      search: "",
    }),
  ).toEqual([]);
});

test("group headers do not count as search results", () => {
  const items = buildResourceListItems({
    rows,
    attributes,
    settings: resourceListSettings({ columnGrouping: "device" }),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "missing resource",
  });
  expect(items).toHaveLength(2);
  expect(countResourceListRows(items)).toBe(0);
  expect(countResourceListRows(build())).toBe(2);
});

test("resource IDs that resemble generated groups collapse independently and retain callback IDs", () => {
  const opened: string[] = [];
  const changed: string[] = [];
  const items = buildResourceListItems({
    rows: [
      {
        id: "group::local",
        title: "Parent",
        attributes: { device: "local" },
        children: [{ id: '["group","local"]', title: "Child", attributes: {} }],
      },
    ],
    attributes,
    settings: resourceListSettings({ columnGrouping: "device" }),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "",
    onRowClick: (row) => {
      opened.push(row.id);
    },
    onAttributeChange: (id) => {
      changed.push(id);
    },
  });
  const parent = items[0].children![0];
  expect(flattenKanbanRendererListItems(items, { [parent.id]: false }).map((row) => row.item.title)).toEqual([
    "This device",
    "Parent",
  ]);
  expect(flattenKanbanRendererListItems(items, { [items[0].id]: false }).map((row) => row.item.title)).toEqual([
    "This device",
  ]);
  expect(new Set(flattenKanbanRendererListItems(items, {}).map((row) => row.id)).size).toBe(3);
  parent.onClick?.();
  parent.onBadgeChange?.("device", "remote");
  expect(opened).toEqual(["group::local"]);
  expect(changed).toEqual(["group::local"]);
});

test("group note actions remain independent from creation and expansion", () => {
  let opened = false;
  const source = structuredClone(attributes);
  if (source[0].type.kind !== "enum" || !Array.isArray(source[0].type.options)) throw new Error("Expected enum");
  source[0].type.options[0].onNoteClick = () => {
    opened = true;
  };
  const items = buildResourceListItems({
    rows,
    attributes: source,
    settings: resourceListSettings({ columnGrouping: "device" }),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
    search: "",
  });
  items[0].onNoteClick?.();
  expect(opened).toBe(true);
  expect(items[0].onCreate).toBeUndefined();
});
