import { expect, test } from "bun:test";
import { createLevelNavigation, createWorkbench } from "../../../core";
import { toTreeListSection } from "./tree-list-adapter";
import { pinnedOnlyNodeIds, withoutPinnedOnlyRows } from "./tree-pinned-only";

test("keeps pinned-only rows out of the body and drops sections they emptied", () => {
  const ids = pinnedOnlyNodeIds([
    { id: "project", nodes: [{ id: "tickets", label: "Tickets", pinnedOnly: true }] },
    { id: "level", nodes: [{ id: "note", label: "Note" }] },
  ]);
  const sections = withoutPinnedOnlyRows(
    [
      { id: "project", nodes: [{ id: "tickets", label: "Tickets" }] },
      { id: "level", nodes: [{ id: "note", label: "Note" }] },
      { id: "empty-level", nodes: [] },
    ],
    ids,
  );
  expect(sections.map((section) => [section.id, section.nodes.map((node) => node.id)])).toEqual([
    ["level", ["note"]],
    ["empty-level", []],
  ]);
});

test("hides an enclosing header item moved into content when entering a navigation level", async () => {
  const workbench = createWorkbench();
  const navigation = createLevelNavigation(workbench);
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  workbench.views.registerView({ id: "details", title: "Details", body: { kind: "react", render: () => null } });
  const page = { kind: "page" as const, extensionId: "test", id: "details" };
  workbench.pages.registerPage({
    id: "details",
    ref: page,
    title: "Details",
    path: "details",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "details" }, cardinality: "one" },
    slots: [],
  });
  workbench.navigationTrees.registerContribution({
    id: "home",
    owner: { kind: "mode", id: "project", extensionId: "pstdio" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    slot: "header",
    getSections: () => [{ id: "header", nodes: [{ id: "home", label: "Home" }] }],
  });
  workbench.navigationTrees.registerContribution({
    id: "details",
    owner: { kind: "page", id: "details", extensionId: "test" },
    sourceExtensionId: "test",
    declarationIndex: 0,
    getSections: () => [{ id: "details", nodes: [{ id: "file", label: "File" }] }],
  });
  workbench.pages.registerPage({
    id: "home",
    ref: { ...page, id: "home" },
    title: "Home",
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "details" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("one");
  workbench.pageLocations.navigate({ kind: "page", page: { ...page, id: "home" } });
  const contentAfterMovingHome = async () => {
    const header = await navigation.getSections("header");
    const content = await navigation.getSections("content");
    const footer = await navigation.getSections("footer");
    // Saved section placement moves Home's declared header section into the body.
    return withoutPinnedOnlyRows(
      [...header, ...content].map((section) => toTreeListSection(section, {}, { workbench })),
      pinnedOnlyNodeIds([...header, ...content, ...footer]),
    );
  };
  expect((await contentAfterMovingHome()).flatMap((section) => section.nodes.map((node) => node.id))).toEqual(["home"]);
  workbench.pageLocations.navigate({ kind: "page", page });
  expect((await contentAfterMovingHome()).flatMap((section) => section.nodes.map((node) => node.id))).toEqual(["file"]);
  workbench.dispose();
});
