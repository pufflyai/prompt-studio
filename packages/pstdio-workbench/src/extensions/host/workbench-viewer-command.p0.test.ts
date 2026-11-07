import { expect, test } from "bun:test";
import type { NavigationTargetViewer } from "@pstdio/sdk/extensions";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { executeWorkbenchExtensionCommandResponse } from "./workbench-extension-command";

for (const operation of ["switch", "replace"] as const) {
  for (const region of ["main", "side"] as const) {
    test(`command ${operation} applies its page hint only to captured Main (${region})`, async () => {
      const { w, openSide, side, other } = createResourceViewerFixture();
      const replacements: string[] = [];
      other();
      if (region === "side") await openSide("draft", "draft");
      const viewer = region === "main" ? w.pages.getContent()! : side();
      const originalSideId = region === "side" ? side().instanceId : undefined;
      const target: NavigationTargetViewer = {
        kind: "viewer",
        operation,
        from: viewer.resource,
        resource: viewerResource("created"),
        page: viewerPage("reader"),
      };
      await executeWorkbenchExtensionCommandResponse(
        {
          projectId: "project",
          workbench: w,
          executeCommand: () => ({ outcome: { ok: true, status: "success", navigationRequests: [target] } }),
        },
        "create",
        { placement: viewer.placementIdentity, onViewerReplace: (resource) => replacements.push(resource.id) },
      );
      if (region === "main") {
        expect(w.pages.store.getState().location?.page).toEqual(viewerPage("reader"));
        expect(w.pages.getContent()?.resource).toEqual(viewerResource("created"));
      } else {
        expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
        expect(side().resource).toEqual(viewerResource("created"));
        expect(side().instanceId).toBe(originalSideId!);
      }
      expect(replacements).toEqual(operation === "replace" ? ["created"] : []);
      expect(w.notifications.store.getState().notifications).toEqual({});
    });
  }
}

test("a late command result cannot change a Side viewer that already switched, or hijack Main", async () => {
  const { w, openSide, side, other } = createResourceViewerFixture();
  other();
  await openSide("draft", "draft");
  const viewer = side();
  const replacements: string[] = [];
  let complete!: (value: unknown) => void;
  const pending = executeWorkbenchExtensionCommandResponse(
    {
      projectId: "project",
      workbench: w,
      executeCommand: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    },
    "create",
    { placement: viewer.placementIdentity, onViewerReplace: (resource) => replacements.push(resource.id) },
  );
  w.viewers.change(viewer.placementIdentity!, {
    operation: "switch",
    from: viewer.resource,
    resource: viewerResource("picked"),
  });
  complete({
    outcome: {
      ok: true,
      status: "success",
      navigationRequests: [
        {
          kind: "viewer",
          operation: "replace",
          from: viewer.resource,
          resource: viewerResource("created"),
          page: viewerPage("reader"),
        },
      ],
    },
  });
  await pending;
  expect(replacements).toEqual([]);
  expect(side().resource?.id).toBe("picked");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
});

test("a panel page hint cannot bypass its resource-kind binding or the expected from resource", async () => {
  const { w, openSide, side, other } = createResourceViewerFixture();
  other();
  await openSide("draft", "draft");
  const viewer = side();
  const replacements: string[] = [];
  for (const target of [
    { from: viewer.resource, resource: viewerResource("forbidden", "another-kind") },
    { from: viewerResource("wrong-source"), resource: viewerResource("created") },
  ]) {
    await executeWorkbenchExtensionCommandResponse(
      {
        projectId: "project",
        workbench: w,
        executeCommand: () => ({
          outcome: {
            ok: true,
            status: "success",
            navigationRequests: [
              {
                kind: "viewer",
                operation: "replace",
                page: viewerPage("reader"),
                ...target,
              },
            ],
          },
        }),
      },
      "create",
      { placement: viewer.placementIdentity, onViewerReplace: (resource) => replacements.push(resource.id) },
    );
    expect(replacements).toEqual([]);
    expect(side().resource).toEqual(viewer.resource);
    expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
  }
});
