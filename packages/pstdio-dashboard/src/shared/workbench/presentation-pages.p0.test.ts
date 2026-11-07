import { expect, test } from "bun:test";
import { contributionRefId, homePages, workbenchPages, workspacePages } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchPageBrowserEntry } from "@pstdio/workbench";
import { defaultPageResourceCodec, serializeWorkbenchPageUrl } from "pstdio-api-contracts";
import { createPresentationModule, resolvePresentationPage } from "./presentation-pages";

test("an independently identified Home supplies startup and saved bundled links until disabled", () => {
  const w = createWorkbench({ startPage: workbenchPages.start });
  w.modes.registerMode({ id: "project", activate() {} });
  w.registerModule(createPresentationModule());
  const ref = { kind: "page" as const, extensionId: "example.welcome", id: "welcome" };
  const registration = w.pages.registerPage({
    id: contributionRefId(ref),
    ref,
    path: "home",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pageLocations.setProject("p1");
  expect(w.pageLocations.boot("p1").ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(ref);
  expect(w.pageLocations.navigate({ kind: "page", page: homePages.home }).ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(ref);
  registration.dispose();
  expect(w.pages.store.getState().location).toBeUndefined();
  expect(w.pages.listPages()).toEqual([]);
  w.dispose();
});

test("saved workspace document URLs migrate to the replacement's document and parameter contracts", () => {
  let entry = { url: "/projects/p1" };
  const w = createWorkbench({
    pageLocationBrowser: {
      current: () => entry,
      push: (next) => {
        entry = next;
      },
      replace: (next) => {
        entry = next;
      },
      back() {},
      forward() {},
      onPopState: () => ({ dispose() {} }),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.registerModule(createPresentationModule());
  const root = { kind: "page" as const, extensionId: "example.browser", id: "browse" };
  const detail = { ...root, id: "detail" };
  w.pages.registerPage({
    id: contributionRefId(root),
    ref: root,
    path: "workspaces",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pages.registerPage({
    id: contributionRefId(detail),
    ref: detail,
    path: "workspace",
    modeId: "project",
    parentId: contributionRefId(root),
    resource: { kinds: [{ kind: "resource-kind", extensionId: "pstdio", id: "workspace" }] },
    document: { metadataKey: "workspaceFilePath" },
    params: { comparison: { type: "string" } },
    main: { kind: "panels" },
    slots: [],
  });
  const resource = {
    type: "workspace",
    extensionId: "pstdio",
    id: "one",
    metadata: { workspaceFilePath: "src/index.ts" },
  };
  entry = {
    url: serializeWorkbenchPageUrl({
      projectId: "p1",
      location: { page: workbenchPages.workspace, resource, params: { comparison: "current" }, position: { line: 12 } },
      pages: w.pages.listPages(),
      resources: defaultPageResourceCodec,
    }),
  };
  w.pageLocations.setProject("p1");
  expect(w.pageLocations.boot("p1").ok).toBe(true);
  expect(w.pages.store.getState().location).toMatchObject({
    page: detail,
    resource,
    params: { comparison: "current" },
    position: { line: 12 },
    parent: { page: root },
  });
  expect(entry.url).toContain("/extensions/example.browser/workspace?");
  expect(new URL(entry.url, "http://dashboard.local").searchParams.get("document")).toBe("src/index.ts");
  w.dispose();
});

test("presentation selection is deterministic, prefers the bundled default, and resolves workspace resources", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", activate() {} });
  w.registerModule(createPresentationModule());
  const register = (extensionId: string, id: string, path: string, parentId?: string) => {
    const ref = { kind: "page" as const, extensionId, id };
    return w.pages.registerPage({
      id: contributionRefId(ref),
      ref,
      path,
      parentId,
      modeId: "project",
      ...(parentId ? { resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] } } : {}),
      main: { kind: "panels" },
      slots: [],
    });
  };
  register("z.browser", "list", "workspaces");
  register("a.browser", "list", "workspaces");
  const root = contributionRefId({ kind: "page", extensionId: "a.browser", id: "list" });
  register("a.browser", "detail", "workspace", root);
  expect(resolvePresentationPage(w, "workspaces")?.ref.extensionId).toBe("a.browser");
  const bundled = register(workspacePages.list.extensionId!, workspacePages.list.id, "workspaces");
  expect(resolvePresentationPage(w, "workspaces")?.ref).toEqual(workspacePages.list);
  bundled.dispose();
  w.pageLocations.setProject("p1");
  const resource = { type: "workspace", id: "one" };
  expect(w.pageLocations.navigate({ kind: "page", page: workbenchPages.workspace, resource }).ok).toBe(true);
  expect(w.pages.store.getState().location).toMatchObject({
    page: { extensionId: "a.browser", id: "detail" },
    resource,
  });
  w.dispose();
});

test("upgrading a saved workspace document retains its explicit ticket parent from browser history", () => {
  let entry: WorkbenchPageBrowserEntry = { url: "/projects/p1" };
  const browser = {
    current: () => entry,
    push: (next: WorkbenchPageBrowserEntry) => {
      entry = next;
    },
    replace: (next: WorkbenchPageBrowserEntry) => {
      entry = next;
    },
    back() {},
    forward() {},
    onPopState: () => ({ dispose() {} }),
  };
  const normal = { main: { kind: "panels" as const }, slots: [] };
  const ticket = { kind: "page" as const, extensionId: "example.tickets", id: "detail" };
  const root = { kind: "page" as const, extensionId: "example.browser", id: "browse" };
  const detail = { ...root, id: "detail" };
  const resource = { type: "workspace", id: "one", metadata: { workspaceFilePath: "src/index.ts" } };
  const routed = {
    resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] },
    document: { metadataKey: "workspaceFilePath" },
  };
  const old = createWorkbench({ pageLocationBrowser: browser });
  old.modes.registerMode({ id: "project", activate() {} });
  old.pages.registerPage({
    ...normal,
    id: "workspaces",
    ref: workbenchPages.workspaces,
    path: "workspaces",
    modeId: "project",
  });
  old.pages.registerPage({
    ...normal,
    ...routed,
    id: "workspace",
    ref: workbenchPages.workspace,
    path: "workspace",
    modeId: "project",
    parentId: "workspaces",
  });
  old.pages.registerPage({ ...normal, id: "ticket", ref: ticket, path: "ticket", modeId: "project" });
  old.pageLocations.setProject("p1");
  expect(
    old.pageLocations.navigate({
      kind: "page",
      page: workbenchPages.workspace,
      resource,
      parent: { kind: "page", page: ticket },
    }).ok,
  ).toBe(true);
  old.dispose();
  const next = createWorkbench({ pageLocationBrowser: browser });
  next.modes.registerMode({ id: "project", activate() {} });
  next.registerModule(createPresentationModule());
  next.pages.registerPage({ ...normal, id: "ticket", ref: ticket, path: "ticket", modeId: "project" });
  next.pages.registerPage({ ...normal, id: "browse", ref: root, path: "workspaces", modeId: "project" });
  next.pages.registerPage({
    ...normal,
    ...routed,
    id: "detail",
    ref: detail,
    path: "workspace",
    modeId: "project",
    parentId: "browse",
  });
  expect(next.pageLocations.boot("p1").ok).toBe(true);
  expect(next.pages.store.getState().location).toMatchObject({ page: detail, resource, parent: { page: ticket } });
  next.dispose();
});
