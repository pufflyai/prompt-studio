import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { registerResourcePage } from "./page-runtime-test-support";

test("applies a shell Sub Panel opened after a scoped page becomes active", async () => {
  const workbench = createWorkbench({
    resolvePagePersistenceScope: ({ projectId, resource }) => ({
      scope: projectId && resource ? `${projectId}/${resourceKey(resource)}` : undefined,
    }),
  });
  const pageRef = { extensionId: "pstdio.test", kind: "page" as const, id: "workspace" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: "workspace",
    title: "Workspace",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "terminal",
    title: "Terminal",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "files",
    title: "Files",
    body: { kind: "react", render: () => null },
  });
  workbench.shellPlacements.registerPlacement({
    id: "terminal",
    item: {
      kind: "binding",
      binding: {
        kinds: [
          {
            kind: "resource-kind",
            id: "terminal",
          },
        ],
        view: {
          kind: "view",
          id: "terminal",
        },
        cardinality: "many",
      },
    },
    region: "secondary",
  });
  registerResourcePage(workbench, {
    id: "workspace",
    ref: pageRef,
    title: "Workspace",
    path: "workspace",
    modeId: "project",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "workspace",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "workspace",
      },
      cardinality: "many",
    },
    slots: [
      {
        id: "files",
        region: "main",
        openOn: "page-resource",
        item: {
          kind: "binding",
          binding: {
            kinds: [
              {
                kind: "resource-kind",
                id: "workspace",
              },
            ],
            view: {
              kind: "view",
              id: "files",
            },
            cardinality: "one",
          },
        },
      },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  let opened = false;
  workbench.pages.store.subscribe((state) => {
    if (opened || state.activePageId !== "workspace") return;
    opened = true;
    workbench.shellPlacements.openPlacement({
      placementId: "terminal",
      resource: {
        type: "terminal",
        id: "terminal://workspace-1",
      },
      open: "pin",
    });
  });
  await workbench.navigation.openTarget({
    kind: "page",
    page: pageRef,
    resource: { type: "workspace", id: "workspace-1" },
  });
  expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([
    expect.objectContaining({
      resource: { type: "terminal", id: "terminal://workspace-1" },
      ownerResourceKey: resourceKey({ type: "workspace", id: "workspace-1" }),
    }),
  ]);
});
