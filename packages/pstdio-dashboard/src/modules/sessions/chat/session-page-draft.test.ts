import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createSessionBubbleModule } from "../bubble/module";
import { openCreatedSessionFromDraft } from "./session-chat-actions";

const createPageDraft = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.registerModule(createSessionBubbleModule());
  workbench.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: workbenchPages.sessions,
    title: "Sessions",
    path: "sessions",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "newSession",
    ref: workbenchPages.newSession,
    title: "New session",
    path: "sessions/new",
    modeId: "project",
    parentId: "sessions",
    resource: { kinds: [{ kind: "resource-kind", id: "session-draft" }] },
    main: { kind: "view", view: { kind: "view", id: "session" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "session",
    ref: workbenchPages.session,
    title: "Session",
    path: "session",
    modeId: "project",
    parentId: "sessions",
    resource: { kinds: [{ kind: "resource-kind", id: "session" }] },
    main: { kind: "view", view: { kind: "view", id: "session" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.newSession,
    resource: { type: "session-draft", id: "draft" },
  });
  const input = {
    workbench,
    region: "main" as const,
    instance: workbench.layout.getActivePanel("main")!,
  };
  return { workbench, input };
};

test("the New session tab opens the created session", () => {
  const { workbench, input } = createPageDraft();
  workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.sessions });
  expect(workbench.layout.listPanelInstances("main")).toHaveLength(1);
  openCreatedSessionFromDraft({
    input,
    draftKey: "draft",
    sessionId: "created",
    prompt: "Build the tool",
    projectId: "project-1",
  });
  expect(workbench.pages.store.getState().location?.resource).toMatchObject({ type: "session", id: "created" });
  expect(workbench.layout.listPanelInstances("main")).toHaveLength(1);
  expect(workbench.layout.getActivePanel("main")?.resource?.id).toBe("created");
});

test("starting a draft replaces only that draft and keeps other open sessions", () => {
  const { workbench, input } = createPageDraft();
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.session,
    resource: { type: "session", id: "other" },
  });
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.newSession,
    resource: input.instance.resource,
  });
  openCreatedSessionFromDraft({
    input,
    draftKey: "draft",
    sessionId: "created",
    prompt: "Build it",
    projectId: "project-1",
  });
  expect(workbench.layout.listPanelInstances("main").map((tab) => tab.resource?.id)).toEqual(["other", "created"]);
  expect(workbench.layout.getActivePanel("main")?.resource?.id).toBe("created");
});

test("creating a session does not leave a page the user opened while creation was pending", () => {
  const { workbench, input } = createPageDraft();
  workbench.pageLocations.navigate({
    kind: "page",
    page: workbenchPages.session,
    resource: { type: "session", id: "other" },
  });
  openCreatedSessionFromDraft({
    input,
    draftKey: "draft",
    sessionId: "created",
    prompt: "Build the tool",
    projectId: "project-1",
  });
  expect(workbench.pages.store.getState().location?.resource?.id).toBe("other");
  expect(workbench.layout.getActivePanel("main")?.resource?.id).toBe("other");
});

test.each([
  "side",
  "secondary",
] as const)("a draft moved to %s becomes one session without leaving the current page", (region) => {
  const { workbench, input } = createPageDraft();
  workbench.movePanel(input.instance.instanceId, region);
  workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.sessions });
  const location = workbench.pages.store.getState().location;
  openCreatedSessionFromDraft({
    input,
    draftKey: "draft",
    sessionId: "created",
    prompt: "Build the tool",
    projectId: "project-1",
  });
  expect(workbench.pages.store.getState().location).toEqual(location);
  expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
  expect(workbench.layout.listPanelInstances(region)).toEqual([
    expect.objectContaining({ resource: expect.objectContaining({ type: "session", id: "created" }) }),
  ]);
});
