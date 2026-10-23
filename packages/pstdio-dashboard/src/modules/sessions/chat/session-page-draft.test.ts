import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { openCreatedSessionFromDraft } from "./session-chat-actions";

const createPageDraft = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "sessions",
    ref: workbenchPages.sessions,
    title: "Sessions",
    path: "sessions",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "session" } },
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
  workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.sessions });
  const input = {
    workbench,
    region: "main" as const,
    owner: { kind: "page" as const, projectId: "project-1", location: workbench.pages.store.getState().location! },
  };
  return { workbench, input };
};

test("a page placeholder opens the created session without a draft tab", () => {
  const { workbench, input } = createPageDraft();
  expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
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
});
