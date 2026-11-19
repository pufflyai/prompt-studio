import { expect, test } from "bun:test";
import { applyTreeListOrder } from "@pstdio/ui";
import { activeTreeGroupLayout, mergeLevelSectionOrder } from "./tree-group-scope";

test("groups from another navigation owner do not capture rows in the current mode", () => {
  const sections = [{ id: "header", moveScope: "mode-b", nodes: [{ id: "search", label: "Search" }] }];
  const groups = [{ id: "research", label: "Research", moveScope: "mode-a" }];
  const layout = activeTreeGroupLayout(sections, groups, { header: [], research: ["search"] });
  expect(applyTreeListOrder(sections, [], layout.nodeOrderBySection, layout.groups)).toEqual(sections);

  const original = activeTreeGroupLayout([{ ...sections[0]!, moveScope: "mode-a" }], groups, {
    header: [],
    research: ["search"],
  });
  expect(original.groups).toEqual(groups);
  expect(original.nodeOrderBySection.research).toEqual(["search"]);
});

test("only the current navigation level shows its groups when parent rows stay pinned", () => {
  const root = "mode:pstdio:project";
  const active = "page:pstdio.notes:notes";
  const sections = [
    { id: "header", moveScope: root, nodes: [{ id: "search", label: "Search" }] },
    { id: "notes", moveScope: active, nodes: [{ id: "new-note", label: "New note" }] },
  ];
  const groups = [
    { id: "legacy", label: "Legacy group" },
    { id: "research", label: "Research", moveScope: root },
    { id: "drafts", label: "Drafts", moveScope: active },
  ];
  const order = { header: ["search"], research: ["search"], drafts: ["new-note"] };
  const subnav = activeTreeGroupLayout(sections, groups, order, { active, root });
  expect(subnav.groups.map((group) => group.id)).toEqual(["drafts"]);
  expect(subnav.nodeOrderBySection).toEqual({ header: ["search"], drafts: ["new-note"] });
  expect(applyTreeListOrder(sections, [], subnav.nodeOrderBySection, subnav.groups)).toMatchObject([
    sections[0],
    { id: "notes", nodes: [] },
    { id: "drafts", nodes: [{ id: "new-note" }] },
  ]);

  const projectNav = activeTreeGroupLayout(sections.slice(0, 1), groups, order, { active: root, root });
  expect(projectNav.groups.map((group) => group.id)).toEqual(["legacy", "research"]);
  expect(projectNav.nodeOrderBySection).toEqual({ header: [], research: ["search"] });
  const rows = applyTreeListOrder(sections.slice(0, 1), [], projectNav.nodeOrderBySection, projectNav.groups);
  expect(
    rows.filter((section) => section.nodes.some((node) => node.id === "search")).map((section) => section.id),
  ).toEqual(["research"]);
});

test("saving a subnav order retains the project level's group order", () => {
  const saved = ["header", "secondary", "primary", "notes"];
  expect(mergeLevelSectionOrder(saved, ["header", "notes", "drafts"])).toEqual([
    "header",
    "secondary",
    "primary",
    "notes",
    "drafts",
  ]);
});
