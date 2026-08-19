import { describe, expect, test } from "bun:test";
import { createResourceRegistry } from "../../registries/resources/resource-registry";
import { createResourceBreadcrumbItems } from "./breadcrumb-registry";

describe("createResourceBreadcrumbItems", () => {
  test("creates navigable ancestors and leaves the current resource inert", async () => {
    const opened: { uri: string; replaceActive: boolean | undefined }[] = [];
    const resources = createResourceRegistry();
    const root = { kind: "docs", uri: "pstdio://docs", label: "Docs", icon: "Library" };
    const section = { kind: "section", uri: "pstdio://section/concepts", label: "Concepts" };
    const page = { kind: "page", uri: "pstdio://page/resources", label: "Resources" };
    const parents = new Map([
      [section.uri, root],
      [page.uri, section],
    ]);

    for (const kind of ["docs", "section", "page"]) {
      resources.registerKind({ kind, label: kind });
    }
    resources.registerHierarchyProvider({
      id: "docs",
      canResolve: () => true,
      getParent: (resource) => parents.get(resource.uri),
    });
    resources.registerPresenter({
      id: "docs",
      canOpen: () => true,
      open: (resource, input) => {
        opened.push({ uri: resource.uri, replaceActive: input.replaceActive });
        return { instanceId: resource.uri, panelId: "docs", closable: false };
      },
    });

    const items = createResourceBreadcrumbItems(resources, page);
    expect(items.map((item) => item.title)).toEqual(["Docs", "Concepts", "Resources"]);
    expect(items[2]?.onClick).toBeUndefined();

    // Opening a breadcrumb parent replaces the active primary location.
    items[0]?.onClick?.();
    await Promise.resolve();
    expect(opened).toEqual([{ uri: root.uri, replaceActive: true }]);
  });

  test("renders the complete acyclic resource path when parent resolution cycles", () => {
    const resources = createResourceRegistry();
    const first = { kind: "ticket", uri: "pstdio://ticket/first", label: "PS-1" };
    const second = { kind: "ticket", uri: "pstdio://ticket/second", label: "PS-2" };

    resources.registerHierarchyProvider({
      id: "cycle",
      canResolve: () => true,
      getParent: (resource) => (resource.uri === second.uri ? first : second),
    });

    expect(createResourceBreadcrumbItems(resources, second).map((item) => item.title)).toEqual(["PS-1", "PS-2"]);
  });

  test("returns no items without a selected resource", () => {
    const resources = createResourceRegistry();

    expect(createResourceBreadcrumbItems(resources, undefined)).toEqual([]);
  });
});
