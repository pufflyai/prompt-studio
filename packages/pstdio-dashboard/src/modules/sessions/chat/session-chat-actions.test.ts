import { describe, expect, mock, test } from "bun:test";
import { workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { createWorkbench, type ResourceRef, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { Dispatch, SetStateAction } from "react";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  type CreateSessionMutation,
  moveQueuedFollowUpBySteps,
  openCreatedSessionFromDraft,
  submitSessionMessage,
} from "./session-chat-actions";
import type { PendingFollowUpState } from "./session-chat-state";

const draftResource: ResourceRef = {
  kind: "session-draft",
  uri: "pstdio://extension-resource/session-draft/new",
  id: "new",
  label: "New session",
};

describe("openCreatedSessionFromDraft", () => {
  test("updates the current draft placement with the created session", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: dashboardWidgetIds.sessionBubble,
      title: "Session",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({ id: "start", title: "Start", body: { kind: "react", render: () => null } });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.pages.registerPage({
      id: "start",
      ref: { extensionId: "pstdio", kind: "page", id: "start" },
      modeId: "project",
      path: "",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
    });
    workbench.modePlacements.registerPlacement({
      id: "dashboard.session-bubble.project",
      ref: workbenchPanels.projectSession,
      modeId: "project",
      item: {
        kind: "resource",
        viewId: dashboardWidgetIds.sessionBubble,
        resourceKinds: ["session", "session-draft"],
        cardinality: "many",
      },
      region: "side",
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId: "pstdio", kind: "page", id: "start" },
    });
    workbench.modePlacements.openPlacement({
      panel: workbenchPanels.projectSession,
      resource: draftResource,
      open: "pin",
    });
    const placement = workbench.layout.listPanelInstances("side")[0]!;
    const input: WorkbenchPanelRenderInput = {
      workbench,
      panel: workbench.layout.getPanel(placement.panelId)!,
      instance: placement,
      refresh: () => undefined,
    };

    openCreatedSessionFromDraft({
      input,
      sessionId: "session-created-from-draft",
      prompt: "Start the project plan",
      projectId: "project-1",
    });

    const opened = workbench.layout.getLayout().regions.side.widgets[0];

    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
    expect(opened?.widgetId).toBe(placement.instanceId);
    expect(opened?.resourceUri).toBe("pstdio://extension-resource/session/session-created-from-draft");
    expect(opened?.resource?.kind).toBe("session");
    expect(opened?.title).toBe("Start the project plan");
  });

  test("replaces a Sessions page draft with the created session", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: dashboardWidgetIds.session,
      title: "Session",
      body: { kind: "react", render: () => null },
    });
    workbench.modes.registerMode({ id: "sessions", activate: () => undefined });
    workbench.pages.registerPage({
      id: "sessions",
      ref: workbenchPages.sessions,
      modeId: "sessions",
      path: "sessions",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: {
            resourceKinds: ["session", "session-draft"],
            viewId: dashboardWidgetIds.session,
            cardinality: "one",
          },
        },
      ],
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({
      kind: "page",
      page: workbenchPages.sessions,
      resource: { type: "session-draft", id: "new", label: "New session" },
    });
    const placement = workbench.layout.listPanelInstances("main")[0]!;

    openCreatedSessionFromDraft({
      input: {
        workbench,
        panel: workbench.layout.getPanel(placement.panelId)!,
        instance: placement,
        refresh: () => undefined,
      },
      sessionId: "session-created-from-page-draft",
      prompt: "Use the diagram",
      projectId: "project-1",
    });

    expect(workbench.pages.store.getState().location?.resource).toMatchObject({
      type: "session",
      id: "session-created-from-page-draft",
      label: "Use the diagram",
    });
    expect(workbench.getPrimaryResource()).toMatchObject({
      kind: "session",
      id: "session-created-from-page-draft",
    });
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

describe("moveQueuedFollowUpBySteps", () => {
  test("uses each returned adjacent queue position for a multi-step move", async () => {
    const mutateAsync = mock(async (input: { queuePosition: number }) => ({
      ok: true as const,
      queuePosition: input.queuePosition === 9 ? 4 : 1,
    }));
    const reconnect = mock(() => undefined);

    await moveQueuedFollowUpBySteps({
      sessionId: "session-1",
      queuePosition: 9,
      direction: "up",
      steps: 2,
      mutation: { mutateAsync },
      reconnect,
    });

    expect(mutateAsync.mock.calls.map(([input]) => input.queuePosition)).toEqual([9, 4]);
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  test("reconnects after a move mutation fails", async () => {
    const mutateAsync = mock(async () => {
      throw new Error("move failed");
    });
    const reconnect = mock(() => undefined);

    await moveQueuedFollowUpBySteps({
      sessionId: "session-1",
      queuePosition: 9,
      direction: "up",
      steps: 2,
      mutation: { mutateAsync },
      reconnect,
    });

    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});
