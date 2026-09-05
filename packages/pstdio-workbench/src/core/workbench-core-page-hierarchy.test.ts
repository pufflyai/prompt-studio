import { describe, expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

const pageRef = (id: string) => ({ extensionId: "example.tools", kind: "page" as const, id });

const createTools = () => {
  const workbench = createWorkbench({ startPage: pageRef("start") });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  for (const id of ["start", "ticket", "workspace"]) {
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  }
  workbench.pages.registerPage({
    id: "start",
    ref: pageRef("start"),
    path: "start",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  for (const id of ["ticket", "archive", "workspace"]) {
    const kind = id === "workspace" ? "workspace" : "ticket";
    workbench.pages.registerPage({
      id,
      ref: pageRef(id),
      path: id,
      modeId: "project",
      parentId: "start",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { resourceKinds: [kind], viewId: kind, cardinality: "one" },
        },
      ],
    });
  }
  workbench.resources.registerHierarchyProvider({
    id: "workspace-ticket",
    canResolve: (resource) => resource.kind === "workspace",
    getParent: () => ({ kind: "ticket", id: "PS-326", uri: "pstdio://ticket/PS-326" }),
  });
  workbench.pageLocations.setProject("project-1");
  return workbench;
};

describe("explicit page ancestry", () => {
  test("uses the declared parent when several pages accept the same parent resource and view", () => {
    const workbench = createTools();
    const result = workbench.pageLocations.navigate({
      kind: "page",
      page: pageRef("workspace"),
      resource: { type: "workspace", id: "WS-1" },
    });
    expect(result.ok).toBe(true);
    expect(workbench.pages.store.getState().location?.parent).toEqual({ page: pageRef("start") });
  });

  test("returns to the exact contextual parent supplied by the navigation owner", () => {
    const workbench = createTools();
    workbench.pageLocations.navigate({
      kind: "page",
      page: pageRef("workspace"),
      resource: { type: "workspace", id: "WS-1" },
      parent: { kind: "page", page: pageRef("ticket"), resource: { type: "ticket", id: "PS-326" } },
    });
    expect(workbench.pageLocations.navigateToParent().ok).toBe(true);
    expect(workbench.pages.store.getState().location).toMatchObject({
      page: pageRef("ticket"),
      resource: { type: "ticket", id: "PS-326" },
    });
  });
});
