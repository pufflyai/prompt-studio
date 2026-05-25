import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef, type WorkbenchWidgetRenderInput } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openCreatedSessionFromDraft } from "./session-chat-actions";

const draftResource: ResourceRef = {
  kind: "session-draft",
  uri: "dashboard-workbench://session-draft/new",
  id: "new",
  label: "New session",
};

describe("openCreatedSessionFromDraft", () => {
  test("replaces the current draft placement with the created session", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerWidget({
      id: dashboardWidgetIds.session,
      title: "Session",
      area: "main",
      rendererId: dashboardWidgetIds.session,
    });
    const placement = workbench.layout.openWidget(dashboardWidgetIds.session, {
      resource: draftResource,
      title: draftResource.label,
    });
    const input: WorkbenchWidgetRenderInput = {
      workbench,
      widget: workbench.layout.getWidget(dashboardWidgetIds.session)!,
      placement,
      refresh: () => undefined,
    };

    openCreatedSessionFromDraft({
      input,
      sessionId: "session-created-from-draft",
      prompt: "Start the project plan",
      projectId: "project-1",
    });

    const opened = workbench.layout.getLayout().areas.main.widgets[0];

    expect(opened?.resourceUri).toBe("dashboard-workbench://session/session-created-from-draft");
    expect(opened?.resource?.kind).toBe("session");
    expect(opened?.title).toBe("Start the project plan");
  });
});
