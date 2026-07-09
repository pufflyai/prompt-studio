import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef, type WorkbenchWidgetRenderInput } from "@pstdio/workbench/core";
import type { Dispatch, SetStateAction } from "react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { type CreateSessionMutation, openCreatedSessionFromDraft, submitSessionMessage } from "./session-chat-actions";
import type { PendingFollowUpState } from "./session-chat-state";

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

describe("submitSessionMessage", () => {
  test("creates draft sessions in the selected workspace", () => {
    let pendingFollowUp: PendingFollowUpState | null = null;
    const setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>> = (next) => {
      pendingFollowUp = typeof next === "function" ? next(pendingFollowUp) : next;
    };
    const mutate = mock(
      (
        _input: Parameters<CreateSessionMutation["mutate"]>[0],
        options: Parameters<CreateSessionMutation["mutate"]>[1],
      ) => {
        options.onSuccess({ sessionId: "session-1", status: "running" });
      },
    );

    submitSessionMessage({
      sessionId: null,
      projectId: "project-1",
      agent: "opencode",
      model: undefined,
      workspaceId: "workspace-2",
      text: "Start implementation",
      messages: [],
      pendingIdRef: { current: 0 },
      setPendingFollowUp,
      createSession: { mutate },
      followUp: { mutate: mock(() => undefined) },
      reconnect: () => undefined,
    });

    expect(mutate).toHaveBeenCalledWith(
      {
        projectId: "project-1",
        prompt: "Start implementation",
        agent: "opencode",
        model: undefined,
        workspaceId: "workspace-2",
      },
      expect.any(Object),
    );
  });
});
