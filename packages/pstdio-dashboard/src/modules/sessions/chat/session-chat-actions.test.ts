import { describe, expect, mock, test } from "bun:test";
import { resourceKey, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { createWorkbench, type ResourceRef, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { type CreateSessionMutation, openCreatedSessionFromDraft, submitSessionMessage } from "./session-chat-actions";
import { getPendingFollowUp } from "./session-chat-state";

const draftResource: ResourceRef = {
  type: "session-draft",
  id: "new",
  label: "New session",
};
const openDraftInSidePanel = () => {
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
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "start",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.modePlacements.registerPlacement({
    id: "dashboard.session-bubble.project",
    ref: workbenchPanels.projectSession,
    modeId: "project",
    item: {
      kind: "binding",
      binding: {
        kinds: [
          {
            kind: "resource-kind",
            id: "session",
          },
          {
            kind: "resource-kind",
            id: "session-draft",
          },
        ],
        view: {
          kind: "view",
          id: dashboardWidgetIds.sessionBubble,
        },
        cardinality: "many",
      },
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
  return { input, placement, workbench };
};
describe("openCreatedSessionFromDraft", () => {
  test("updates the current draft placement with the created session", () => {
    const { input, placement, workbench } = openDraftInSidePanel();
    openCreatedSessionFromDraft({
      input,
      draftKey: "new",
      sessionId: "session-created-from-draft",
      prompt: "Start the project plan",
      projectId: "project-1",
    });
    const opened = workbench.layout.getLayout().regions.side.widgets[0];
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
    expect(opened?.widgetId).toBe(placement.instanceId);
    expect(opened?.resourceKey).toBe(resourceKey({ type: "session", id: "session-created-from-draft" }));
    expect(opened?.resource?.type).toBe("session");
    expect(opened?.title).toBe("Start the project plan");
  });
  test("leaves a placement the user moved to another session while the request was open", () => {
    const { input, workbench } = openDraftInSidePanel();
    const other = { type: "session", id: "session-picked", label: "Picked session" };
    workbench.modePlacements.updatePlacement(input.instance.placementIdentity!, {
      resource: other,
      title: other.label,
    });
    openCreatedSessionFromDraft({
      input,
      draftKey: "new",
      sessionId: "session-created-from-draft",
      prompt: "Start the project plan",
      projectId: "project-1",
    });
    expect(workbench.layout.getLayout().regions.side.widgets[0]?.resourceKey).toBe(resourceKey(other));
  });
  test.each(["home", "draft"])("opens the created session from the %s page", (origin) => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: dashboardWidgetIds.session,
      title: "Session",
      body: { kind: "react", render: () => null },
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.pages.registerPage({
      id: "sessions",
      ref: workbenchPages.sessions,
      modeId: "project",
      path: "sessions",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: dashboardWidgetIds.session,
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pages.registerPage({
      id: "session",
      parentId: "sessions",
      ref: workbenchPages.session,
      modeId: "project",
      path: "session",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "session",
          },
          {
            kind: "resource-kind",
            id: "session-draft",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: dashboardWidgetIds.session,
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({
      kind: "page",
      ...(origin === "draft"
        ? { page: workbenchPages.session, resource: { type: "session-draft", id: "new", label: "New session" } }
        : { page: workbenchPages.sessions }),
    });
    const placement = workbench.layout.listPanelInstances("main")[0]!;
    openCreatedSessionFromDraft({
      input: {
        workbench,
        panel: workbench.layout.getPanel(placement.panelId)!,
        instance: placement,
        refresh: () => undefined,
      },
      draftKey: origin === "draft" ? "new" : "draft",
      sessionId: "session-created-from-page-draft",
      prompt: "Use the diagram",
      projectId: "project-1",
    });
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.session);
    expect(workbench.pages.store.getState().location?.resource).toMatchObject({
      type: "session",
      id: "session-created-from-page-draft",
      label: "Use the diagram",
    });
    expect(workbench.getPrimaryResource()).toMatchObject({
      type: "session",
      id: "session-created-from-page-draft",
    });
  });
});
const newSessionInput = {
  sessionId: null,
  projectId: "project-1",
  agent: "codex",
  model: undefined,
  text: "Start here",
  messages: [],
  followUp: { mutateAsync: () => Promise.reject(new Error("Must create a session")) },
  reconnect: () => undefined,
};
describe("submitSessionMessage", () => {
  test("creates draft sessions in the selected workspace", async () => {
    const mutateAsync = mock(async (_input: Parameters<CreateSessionMutation["mutateAsync"]>[0]) => ({
      sessionId: "session-1",
      status: "running",
    }));
    await submitSessionMessage({
      ...newSessionInput,
      conversationKey: "draft-workspace",
      agent: "opencode",
      workspaceId: "workspace-2",
      text: "Start implementation",
      createSession: { mutateAsync },
    });
    expect(mutateAsync).toHaveBeenCalledWith({
      projectId: "project-1",
      prompt: "Start implementation",
      agent: "opencode",
      model: undefined,
      workspaceId: "workspace-2",
    });
  });
  test("a created session takes over its draft's first message", async () => {
    let created: string | undefined;
    await submitSessionMessage({
      ...newSessionInput,
      conversationKey: "draft-handoff",
      createSession: { mutateAsync: async () => ({ sessionId: "session-9", status: "running" }) },
      onSessionCreated: (sessionId) => {
        created = sessionId;
      },
    });
    expect(created).toBe("session-9");
    expect(getPendingFollowUp("draft-handoff")).toBeNull();
    expect(getPendingFollowUp("session-9")).toMatchObject({ prompt: "Start here" });
  });
  test("finishes the send after the chat panel unmounted", async () => {
    // A mutation observer without listeners is what TanStack Query leaves behind after unmount.
    const observer = new MutationObserver<
      { sessionId: string; status: string },
      Error,
      Parameters<CreateSessionMutation["mutateAsync"]>[0]
    >(new QueryClient(), { mutationFn: async () => ({ sessionId: "session-after-unmount", status: "running" }) });
    let created: string | undefined;
    await submitSessionMessage({
      ...newSessionInput,
      conversationKey: "draft-unmounted",
      createSession: { mutateAsync: (variables) => observer.mutate(variables) },
      onSessionCreated: (sessionId) => {
        created = sessionId;
      },
    });
    expect(created).toBe("session-after-unmount");
    expect(getPendingFollowUp("draft-unmounted")).toBeNull();
    expect(getPendingFollowUp("session-after-unmount")).toMatchObject({ prompt: "Start here" });
  });
});
