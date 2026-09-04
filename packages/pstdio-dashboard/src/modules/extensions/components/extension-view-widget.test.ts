import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  type DashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { metadata } from "../module-test-fixtures";
import { resolveExtensionView } from "./extension-view-widget";

const projectId = "project-1";

afterEach(() => clearCachedDashboardExtensionMetadata(projectId));

describe("resolveExtensionView", () => {
  test("resolves content by View id when the panel id belongs to a page placement", () => {
    const workbench = createWorkbench();
    const view = metadata.views[0]!;
    workbench.context.set(dashboardSelectedProjectIdContextKey, projectId);
    setCachedDashboardExtensionMetadata(projectId, metadata);

    const resolved = resolveExtensionView({
      workbench,
      panel: {
        id: "workbench.page-placement.extension-lab.lab.content",
        title: "Lab",
        region: "main",
        rendererId: view.id,
      },
      instance: {
        instanceId: "workbench.page.extension-lab.lab.content.default",
        panelId: "workbench.page-placement.extension-lab.lab.content",
        viewId: view.id,
        closable: false,
      },
    });

    expect(resolved).toMatchObject({ projectId, view: { id: view.id } });
  });

  test("uses the selected project when the placement has no resource", () => {
    const workbench = createWorkbench();
    const view = metadata.views[0]!;
    workbench.context.set(dashboardSelectedProjectIdContextKey, projectId);
    setCachedDashboardExtensionMetadata(projectId, metadata);
    workbench.layout.registerPanel({
      id: view.id,
      title: "Lab",
      region: "main",
      rendererId: "webview:bridge",
    });

    const resolved = resolveExtensionView({
      workbench,
      panel: workbench.layout.getWidget(view.id)!,
      instance: { instanceId: view.id, panelId: view.id, viewId: view.id, closable: false },
    });

    expect(resolved).toMatchObject({ projectId, view: { id: view.id } });
  });

  test("returns the trusted extension owner from project metadata", () => {
    const workbench = createWorkbench();
    const view = metadata.views[0]!;
    const ownedMetadata = {
      ...metadata,
      extensions: [
        {
          ...metadata.extensions[0]!,
          extensionInstanceId: "instance-1",
          installName: "extension-lab",
        },
      ],
    } as DashboardExtensionMetadata;
    workbench.context.set(dashboardSelectedProjectIdContextKey, projectId);
    setCachedDashboardExtensionMetadata(projectId, ownedMetadata);

    const resolved = resolveExtensionView({
      workbench,
      panel: { id: view.id, title: "Lab", region: "main", rendererId: "webview:bridge" },
      instance: { instanceId: view.id, panelId: view.id, viewId: view.id, closable: false },
    });

    expect(resolved).toMatchObject({
      extensionInstanceId: "instance-1",
      installName: "extension-lab",
    });
  });
});
