import { describe, expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import {
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationRouteKey,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";

const resources: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource, id: resource.id.toUpperCase() }),
  toUri: (resource) => `${resource.type}:${resource.id}`,
  fromUri: () => undefined,
};

const page = (id: string, parentId?: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId: "acme.test", kind: "page", id },
  title: id,
  path: id,
  modeId: "project",
  ...(parentId ? { parentId } : {}),
  slots: [{ id: "content", role: "primary", region: "main", viewId: id }],
});

const pages = [page("root"), page("detail", "root"), page("workspace", "root")];

describe("page location normalization", () => {
  test("uses canonical route identity without parent context and full equality with it", () => {
    const declared = normalizeWorkbenchPageTarget({
      target: { kind: "page", page: pages[2]!.ref, resource: { type: "workspace", id: "one" } },
      pages,
      resources,
    }).location;
    const contextual = normalizeWorkbenchPageTarget({
      target: {
        kind: "page",
        page: pages[2]!.ref,
        resource: { type: "workspace", id: "ONE" },
        parent: { kind: "page", page: pages[1]!.ref },
      },
      pages,
      resources,
    }).location;

    expect(workbenchPageLocationRouteKey(declared, resources)).toBe(
      workbenchPageLocationRouteKey(contextual, resources),
    );
    expect(workbenchPageLocationsEqual(declared, contextual, resources)).toBe(false);
    expect(Object.isFrozen(contextual)).toBe(true);
    expect(Object.isFrozen(contextual.resource)).toBe(true);
  });

  test("rejects repeated contextual locations and declared parent cycles", () => {
    expect(() =>
      normalizeWorkbenchPageTarget({
        target: {
          kind: "page",
          page: pages[1]!.ref,
          parent: { kind: "page", page: pages[1]!.ref },
        },
        pages,
        resources,
      }),
    ).toThrow(/cycle/);

    const cyclicPages = [page("a", "b"), page("b", "a")];
    expect(() =>
      normalizeWorkbenchPageTarget({
        target: { kind: "page", page: cyclicPages[0]!.ref },
        pages: cyclicPages,
        resources,
      }),
    ).toThrow(/cycle/);
  });

  test("rejects a repeated route restored from persistence", () => {
    const cyclic: PageLocation = {
      page: pages[1]!.ref,
      parent: { page: pages[1]!.ref },
    };

    expect(() => normalizeWorkbenchPageLocation({ location: cyclic, pages, resources })).toThrow(/cycle/);
  });
});
