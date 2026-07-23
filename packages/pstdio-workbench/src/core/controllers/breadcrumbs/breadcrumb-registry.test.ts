import { describe, expect, test } from "bun:test";
import { createResourceRegistry } from "../../registries/resources/resource-registry";
import { createResourceBreadcrumbItems } from "./breadcrumb-registry";

describe("createResourceBreadcrumbItems", () => {
  test("creates navigable ancestors and leaves the current resource inert", async () => {
    const opened: string[] = [];
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
    resources.registerOpener({
      id: "docs",
      canOpen: () => true,
      open: (resource) => {
        opened.push(resource.uri);
      },
    });

    const items = createResourceBreadcrumbItems(resources, page);
    expect(items.map((item) => item.title)).toEqual(["Docs", "Concepts", "Resources"]);
    expect(items[2]?.onClick).toBeUndefined();

    items[0]?.onClick?.();
    await Promise.resolve();
    expect(opened).toEqual([root.uri]);
  });

  test("returns no items without a selected resource", () => {
    const resources = createResourceRegistry();

    expect(createResourceBreadcrumbItems(resources, undefined)).toEqual([]);
  });
});
