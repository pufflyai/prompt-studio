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
  path: id,
  modeId: "project",
  ...(parentId ? { parentId } : {}),
  main: {
    kind: "view",
    view: {
      kind: "view",
      id: id,
    },
    cardinality: "one",
  },
  slots: [],
});
const sessionPage = (): WorkbenchPageContribution => ({
  ...page("session", "sessions"),
  resource: {
    kinds: [
      {
        kind: "resource-kind",
        id: "session",
      },
    ],
  },
  main: {
    kind: "view",
    view: {
      kind: "view",
      id: "session",
    },
    cardinality: "one",
  },
  slots: [],
});
const pages = [page("root"), page("detail", "root"), page("workspace", "root"), sessionPage(), page("sessions")];

test("a group opens its default child while remaining in the parent trail", () => {
  const child = page("compose", "messages");
  const group: WorkbenchPageContribution = {
    ...page("messages"),
    params: { filter: { type: "string", default: "all" } },
    main: { kind: "group", default: child.ref },
  };
  const declarations = [group, child];
  const target = normalizeWorkbenchPageTarget({
    target: { kind: "page", page: group.ref, params: { filter: "mine" } },
    pages: declarations,
    resources,
  });
  expect(target).toMatchObject({
    pageId: child.id,
    location: { page: child.ref, parent: { page: group.ref, params: { filter: "mine" } } },
  });
  expect(normalizeWorkbenchPageLocation({ location: target.location, pages: declarations, resources })).toEqual(target);
  expect(normalizeWorkbenchPageLocation({ location: { page: group.ref }, pages: declarations, resources }).pageId).toBe(
    child.id,
  );
});

test("a group default must be an available child that opens without a resource", () => {
  const group: WorkbenchPageContribution = {
    ...page("messages"),
    main: { kind: "group", default: page("compose").ref },
  };
  for (const child of [
    undefined,
    page("compose"),
    { ...page("compose", group.id), resource: sessionPage().resource },
  ]) {
    expect(() =>
      normalizeWorkbenchPageTarget({
        target: { kind: "page", page: group.ref },
        pages: [group, ...(child ? [child] : [])],
        resources,
      }),
    ).toThrow();
  }
});

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
  test("uses the declared home page as the parent of a resource page", () => {
    const location = normalizeWorkbenchPageTarget({
      target: { kind: "page", page: pages[3]!.ref, resource: { type: "session", id: "one" } },
      pages,
      resources,
    }).location;
    expect(location).toMatchObject({
      page: pages[3]!.ref,
      resource: { type: "session", id: "ONE" },
      parent: { page: pages[4]!.ref },
    });
  });
});
