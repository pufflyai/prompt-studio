import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

test("restores an open extension page after a transient metadata gap", async () => {
  const projectId = "extension-page-refresh";
  const labView = metadata.views[0]!;
  const labPage = metadata.pages[0]!;
  const surroundingMetadata: WorkbenchExtensionMetadata = {
    ...metadata,
    pages: [
      { ...labPage, id: `${labPage.extensionId}.page.before`, localId: "before", path: "before" },
      labPage,
      { ...labPage, id: `${labPage.extensionId}.page.after`, localId: "after", path: "after" },
    ],
    views: [
      { ...labView, id: `${labView.extensionId}.view.before`, localId: "before" },
      labView,
      { ...labView, id: `${labView.extensionId}.view.after`, localId: "after" },
    ],
  };
  let currentMetadata = surroundingMetadata;
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.views.registerView({ id: "start", title: "Start", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "start",
    ref: { extensionId: "pstdio", kind: "page", id: "start" },
    title: "Start",
    path: "",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  selectDashboardProject(workbench, { id: projectId, name: "Extension page refresh" });
  const extensions = workbench.registerModule(
    createExtensionsModule({
      loadAppearance: async () => emptyAppearance,
      loadMetadata: async () => currentMetadata,
    }),
  );
  const writer = getWriter("extension_instances");

  try {
    await flushMicrotasks();
    await flushMicrotasks();
    workbench.pageLocations.setProject(projectId);
    const open = workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId: "pstdio.extension-lab", kind: "page", id: "labPage" },
    });
    expect(open.ok).toBe(true);

    currentMetadata = {
      ...surroundingMetadata,
      views: surroundingMetadata.views.map((view) =>
        view.body.kind === "webview"
          ? {
              ...view,
              body: {
                ...view.body,
                webview: { ...view.body.webview, moduleUrl: `${view.body.webview.moduleUrl}?revision=2` },
              },
            }
          : view,
      ),
    };
    writer?.upsert({ id: "updated-webview" });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.pages.store.getState().activePageId).toBe("pstdio.extension-lab.page.labPage");

    currentMetadata = emptyDashboardExtensionMetadata;
    writer?.upsert({ id: "transient-gap" });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.pages.store.getState().activePageId).toBe("start");

    currentMetadata = surroundingMetadata;
    writer?.upsert({ id: "restored-metadata" });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(workbench.pages.store.getState()).toMatchObject({
      activePageId: "pstdio.extension-lab.page.labPage",
      location: { page: { extensionId: "pstdio.extension-lab", kind: "page", id: "labPage" } },
    });
  } finally {
    extensions.dispose();
    writer?.remove("transient-gap");
    writer?.remove("restored-metadata");
    writer?.remove("updated-webview");
  }
});
