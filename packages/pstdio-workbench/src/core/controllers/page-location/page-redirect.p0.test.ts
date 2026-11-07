import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("host route aliases resolve to the installed page and preserve resource context", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {} });
  const page = { kind: "page" as const, extensionId: "example.browser", id: "detail" };
  const root = { kind: "page" as const, extensionId: "example.browser", id: "list" };
  w.pages.registerPage({ id: "list", ref: root, path: "list", modeId: "project", main: { kind: "panels" }, slots: [] });
  w.pages.registerPage({
    id: "detail",
    ref: page,
    path: "detail",
    modeId: "project",
    parentId: "list",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    document: { metadataKey: "file" },
    params: { comparison: { type: "string" } },
    main: { kind: "panels" },
    slots: [],
  });
  const alias = { kind: "page" as const, extensionId: "pstdio", id: "workspace" };
  w.pages.registerPage({
    id: "alias",
    ref: alias,
    path: "workspace",
    modeId: "project",
    redirect: () => page,
    main: { kind: "panels" },
    slots: [],
  });
  w.pageLocations.setProject("p1");
  const resource = { type: "workspace", id: "one", metadata: { file: "README.md" } };
  const result = w.pageLocations.navigate({
    kind: "page",
    page: alias,
    resource,
    params: { comparison: "current" },
    position: { line: 3 },
  });
  expect(result.ok).toBe(true);
  expect(w.pages.store.getState().location).toMatchObject({
    page,
    resource,
    params: { comparison: "current" },
    position: { line: 3 },
    parent: { page: root },
  });
  expect(w.pageLocations.replay({ page: alias, resource }).ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(page);
  w.dispose();
});

test("a contributed page's declared legacy parent resolves to the installed collection", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {} });
  const root = { kind: "page" as const, extensionId: "example.browser", id: "browse" };
  const child = { kind: "page" as const, extensionId: "example.other", id: "child" };
  const normal = { path: "browse", modeId: "project", main: { kind: "panels" as const }, slots: [] };
  w.pages.registerPage({ ...normal, id: "browse", ref: root, title: "Workspace browser" });
  w.pages.registerPage({
    ...normal,
    id: "legacy",
    ref: { kind: "page", extensionId: "pstdio", id: "workspaces" },
    redirect: root,
  });
  w.pages.registerPage({ ...normal, id: "child", ref: child, parentId: "legacy" });
  w.pageLocations.setProject("p1");
  expect(w.pageLocations.navigate({ kind: "page", page: child }).ok).toBe(true);
  expect(w.pages.store.getState().location?.parent?.page).toEqual(root);
  w.dispose();
});
