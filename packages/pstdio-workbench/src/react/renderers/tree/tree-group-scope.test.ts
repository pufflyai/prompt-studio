import { expect, test } from "bun:test";
import { applyTreeListOrder } from "@pstdio/ui";
import { activeTreeGroupLayout } from "./tree-group-scope";

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
