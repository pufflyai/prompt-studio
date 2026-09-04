import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("applies a shell Sub Panel opened after a scoped page becomes active", async () => {
  const workbench = createWorkbench({
    resolvePagePersistenceScope: ({ projectId, resource }) => ({
      scope: projectId && resource ? `${projectId}/${resource.uri}` : undefined,
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
    item: { kind: "resource", viewId: "terminal", resourceKinds: ["terminal"], cardinality: "many" },
    region: "secondary",
  });
  workbench.pages.registerPage({
    id: "workspace",
    ref: pageRef,
    title: "Workspace",
    path: "workspace",
    modeId: "project",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        viewId: "workspace",
        binding: { resourceKinds: ["workspace"], viewId: "workspace", cardinality: "many" },
      },
      {
        id: "files",
        role: "auxiliary",
        region: "main",
        binding: { resourceKinds: ["workspace"], viewId: "files", cardinality: "one" },
        openOn: "page-resource",
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
      resource: { kind: "terminal", uri: "terminal://workspace-1" },
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
      resourceUri: "terminal://workspace-1",
      ownerResourceUri: "pstdio://extension-resource/workspace/workspace-1",
    }),
  ]);
});
