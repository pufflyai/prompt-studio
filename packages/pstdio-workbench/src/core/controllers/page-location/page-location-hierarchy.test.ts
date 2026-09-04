import { describe, expect, test } from "bun:test";
import type { NavigationTargetPage, ResourceRef as PageResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import {
  createResourceRegistry,
  type ResourceRef,
  type WorkbenchHierarchyNode,
} from "../../registries/resources/resource-registry";
import { contextualizeWorkbenchPageTarget } from "./page-location-hierarchy";

const ticketsRef = { extensionId: "planner", kind: "page" as const, id: "tickets" };
const ticketRef = { extensionId: "planner", kind: "page" as const, id: "ticket" };
const workspaceRef = { extensionId: "pstdio", kind: "page" as const, id: "workspaces" };
const pages: WorkbenchPageContribution[] = [
  {
    id: "tickets",
    ref: ticketsRef,
    path: "tickets",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "planner.tickets" }],
  },
  {
    id: "ticket",
    ref: ticketRef,
    path: "ticket",
    modeId: "project",
    parentId: "tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["ticket"], viewId: "planner.ticket", cardinality: "one" },
      },
    ],
  },
  {
    id: "workspaces",
    ref: workspaceRef,
    path: "workspaces",
    modeId: "project",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["workspace"], viewId: "workspace", cardinality: "one" },
      },
    ],
  },
];
const resources: WorkbenchPageResourceCodec = {
  normalize: (resource) => resource,
  toUri: (resource) => `pstdio://${resource.type}/${resource.id}`,
  fromUri: () => undefined,
};

const ticketResource = (id: string): PageResourceRef => ({
  type: "ticket",
  id,
  label: id,
});

const toWorkbenchResource = (resource: PageResourceRef): ResourceRef => ({
  kind: resource.type,
  uri: resources.toUri(resource),
  id: resource.id,
  label: resource.label,
});

describe("contextualizeWorkbenchPageTarget", () => {
  test("turns resource hierarchy into a canonical page parent chain", () => {
    const registry = createResourceRegistry();
    const root = ticketResource("ROOT");
    const child = ticketResource("CHILD");
    const workspace: PageResourceRef = {
      type: "workspace",
      id: "WS-1",
      label: "Workspace",
    };
    const parents = new Map<string, WorkbenchHierarchyNode>([
      [workspace.id, toWorkbenchResource(child)],
      [child.id, toWorkbenchResource(root)],
      [root.id, { type: "view", viewId: "planner.tickets" }],
    ]);
    registry.registerHierarchyProvider({
      id: "metadata",
      canResolve: (resource) => parents.has(resource.id ?? ""),
      getParent: (resource) => parents.get(resource.id ?? ""),
    });

    const target = contextualizeWorkbenchPageTarget({
      target: { kind: "page", page: workspaceRef, resource: workspace },
      pages,
      registry,
      resources,
    });

    expect(target).toEqual({
      kind: "page",
      page: workspaceRef,
      resource: workspace,
      parent: {
        kind: "page",
        page: ticketRef,
        resource: child,
        parent: {
          kind: "page",
          page: ticketRef,
          resource: root,
          parent: { kind: "page", page: ticketsRef },
        },
      },
    } satisfies NavigationTargetPage);
  });

  test("keeps an explicit page parent unchanged", () => {
    const registry = createResourceRegistry();
    const parent = { kind: "page" as const, page: ticketsRef };
    const target = { kind: "page" as const, page: ticketRef, resource: ticketResource("T-1"), parent };

    expect(contextualizeWorkbenchPageTarget({ target, pages, registry, resources })).toBe(target);
  });
});
