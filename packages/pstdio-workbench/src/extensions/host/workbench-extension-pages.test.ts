import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const extensionId = "pstdio.lab";
const modeId = `${extensionId}.mode.review`;
const pageId = `${extensionId}.page.review`;
const viewId = `${extensionId}.view.outline`;

const metadata = {
  ...emptyWorkbenchExtensionMetadata,
  extensions: [{ id: extensionId, name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  modes: [{ id: modeId, localId: "review", extensionId, label: "Review", regions: ["main"] }],
  pages: [
    {
      id: pageId,
      localId: "review",
      extensionId,
      title: "Review",
      path: "review",
      mode: { extensionId, kind: "mode", id: "review" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          view: { extensionId, kind: "view", id: "outline" },
        },
      ],
    },
  ],
  views: [
    {
      id: viewId,
      localId: "outline",
      extensionId,
      title: "Outline",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./outline.tsx", baseUrl: "file:///extensions/lab/" },
          runtimeUrl: "/runtime.html",
          moduleUrl: "/outline.js",
        },
      },
    },
  ],
} satisfies WorkbenchExtensionMetadata;

describe("extension page registration", () => {
  test("keeps an extension page open as its Main panels close independently", () => {
    const workbench = createWorkbench();
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: {
        ...metadata,
        pages: [
          {
            ...metadata.pages[0],
            slots: [
              { ...metadata.pages[0].slots[0], subPanelsOnly: true },
              ...["files", "changes"].map((id) => ({
                id,
                role: "auxiliary" as const,
                region: "main" as const,
                view: metadata.pages[0].slots[0].view,
                presence: "open" as const,
              })),
            ],
          },
        ],
      },
      projectId: "project-1",
      workbench,
    });
    workbench.pageLocations.setProject("project-1");
    expect(
      workbench.pageLocations.navigate({ kind: "page", page: { extensionId, kind: "page", id: "review" } }).ok,
    ).toBe(true);
    const location = workbench.pages.store.getState().location;
    for (const slotId of ["changes", "files"]) {
      const active = workbench.layout.getActivePanel("main")!;
      const placement = workbench.layout
        .getLayout()
        .regions.main.widgets.find((item) => item.widgetId === active.instanceId)!;
      expect(placement.placementIdentity).toMatchObject({ slotId });
      expect(workbench.pageLocations.closePlacement(placement.placementIdentity!).ok).toBe(true);
      expect(workbench.pages.store.getState().location).toEqual(location);
    }
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(1);
    registration.dispose();
  });

  test("registers normalized pages in the shared workbench registry", () => {
    const workbench = createWorkbench();
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.pages.getPage(pageId)).toEqual({
      id: pageId,
      ref: { extensionId, kind: "page", id: "review" },
      title: "Review",
      path: "review",
      modeId,
      slots: [{ id: "content", role: "primary", region: "main", viewId }],
    });

    registration.dispose();
    expect(workbench.pages.getPage(pageId)).toBeUndefined();
  });
});
