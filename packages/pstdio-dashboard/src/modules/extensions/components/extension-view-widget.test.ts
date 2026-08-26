import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { metadata } from "../module-test-fixtures";
import { resolveExtensionView } from "./extension-view-widget";

const projectId = "project-1";

afterEach(() => clearCachedDashboardExtensionMetadata(projectId));

describe("resolveExtensionView", () => {
  test("uses the selected project when the placement has no resource", () => {
    const workbench = createWorkbenchCore();
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
      instance: { instanceId: view.id, panelId: view.id, closable: false },
    });

    expect(resolved).toMatchObject({ projectId, view: { id: view.id } });
  });
});
