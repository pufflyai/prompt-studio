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
      main: {
        kind: "view",
        view: { extensionId, kind: "view", id: "outline" },
        cardinality: "one",
      },
      slots: [],
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
  test("opens an extension group's child once and keeps its parent label", () => {
    const workbench = createWorkbench();
    const group = { extensionId, kind: "page", id: "messages" } as const;
    const child = { extensionId, kind: "page", id: "review" } as const;
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: {
        ...metadata,
        pages: [
          {
            ...metadata.pages[0],
            id: `${extensionId}.page.messages`,
            localId: "messages",
            title: "Messages",
            path: "messages",
            main: { kind: "group", default: child },
            slots: [],
          },
          { ...metadata.pages[0], parent: group, main: { ...metadata.pages[0].main, presentation: "page" } },
        ],
      },
      projectId: "project-1",
      workbench,
    });
    workbench.pageLocations.setProject("project-1");
    const commits: string[] = [];
    const unsubscribe = workbench.pages.store.subscribe((state) => commits.push(state.activePageId!));
    const result = workbench.pageLocations.navigate({ kind: "page", page: group });
    expect(result).toMatchObject({ ok: true, location: { page: child, parent: { page: group } } });
    expect(commits).toEqual([pageId]);
    expect(workbench.pages.getContent()?.viewId).toBe(viewId);
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
    expect(workbench.breadcrumbs.getItems()?.[0]).toMatchObject({ title: "Messages" });
    expect(workbench.breadcrumbs.getItems()?.[0]?.onClick).toBeUndefined();
    unsubscribe();
    registration.dispose();
  });
  test("keeps an extension page open as its Main panels close independently", () => {
    const workbench = createWorkbench();
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: {
        ...metadata,
        pages: [
          {
            ...metadata.pages[0],
            main: { kind: "panels", empty: metadata.pages[0].main.view },
            slots: [
              ...["files", "changes"].map((id) => ({
                id,
                region: "main" as const,
                item: { kind: "view" as const, view: metadata.pages[0].main.view, presence: "open" as const },
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
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
    registration.dispose();
  });
  test("keeps placeholder menu resources in the host project", () => {
    const workbench = createWorkbench();
    const pageRef = { extensionId, kind: "page" as const, id: "review" };
    const registration = registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: {
        ...metadata,
        pages: [
          {
            ...metadata.pages[0],
            main: {
              kind: "panels",
              empty: {
                view: metadata.pages[0].main.view,
                breadcrumb: {
                  menu: [
                    {
                      id: "review",
                      rows: [
                        {
                          id: "open",
                          label: "Open review",
                          action: { kind: "page", page: pageRef, resource: { type: "review", id: "same" } },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      projectId: "project-1",
      workbench,
    });
    const empty = workbench.pages.getPage(pageId)?.main.empty;
    if (!empty || !("view" in empty)) throw new Error("Missing placeholder");
    expect(empty.breadcrumb?.menu?.[0]?.rows[0]?.action).toMatchObject({
      kind: "navigation",
      target: { kind: "page", resource: { projectId: "project-1", type: "review", id: "same" } },
    });
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
    expect(workbench.pages.getPage(pageId)).toMatchObject({
      id: pageId,
      ref: { extensionId, kind: "page", id: "review" },
      title: "Review",
      path: "review",
      modeId,
      main: metadata.pages[0].main,
      slots: [],
    });
    registration.dispose();
    expect(workbench.pages.getPage(pageId)).toBeUndefined();
  });
});
