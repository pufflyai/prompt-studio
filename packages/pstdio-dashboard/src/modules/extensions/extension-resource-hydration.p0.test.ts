import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { watchOpenExtensionResource } from "./extension-resource-sync";
import { settle } from "./extension-resource-sync.fixture";

test.each([
  "page",
  "tabs",
] as const)("resolving a bare session link retains its Main %s viewer", async (presentation) => {
  const w = createWorkbench();
  const projectId = "session-hydration";
  const extensionId = "pstdio";
  const page = { kind: "page", extensionId, id: "session" } as const;
  const resource = { type: "session", id: "linked-session", extensionId, projectId, label: "Current title" };
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "sessions",
    ref: { kind: "page", extensionId, id: "sessions" },
    path: "sessions",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pages.registerPage({
    id: "session",
    ref: page,
    path: "session",
    modeId: "project",
    parentId: "sessions",
    resource: { kinds: [{ kind: "resource-kind", extensionId, id: "session" }] },
    main: { kind: "view", view: { kind: "view", id: "session" }, presentation, cardinality: "many" },
    slots: [],
  });
  w.pageLocations.setProject(projectId);
  expect(w.pageLocations.navigate({ kind: "page", page, resource: { type: resource.type, id: resource.id } }).ok).toBe(
    true,
  );
  const current = () => (presentation === "page" ? w.pages.getContent() : w.layout.getActivePanel("main"));
  const currentId = () =>
    presentation === "page" ? w.pages.getContent()?.widgetId : w.layout.getActivePanel("main")?.instanceId;
  const initial = current()!;
  const initialId = currentId();
  const captured = w.viewers.captureContext(initial.placementIdentity!);
  const identities: Array<string | undefined> = [];
  const unsubscribe = w.pages.store.subscribe(() => identities.push(currentId()));
  const subscription = watchOpenExtensionResource(w, {
    projectId,
    metadata: {
      ...emptyDashboardExtensionMetadata,
      resourceKinds: [
        { id: "session", localId: "session", extensionId, resolveCommand: "pstdio.session.resolve", menuSlots: [] },
      ],
    },
    executeCommand: async (_project, commandId) => ({
      commandId,
      extensionId,
      outcome: { ok: true, status: "success", value: resource },
    }),
  });
  try {
    await settle();
    expect(current()?.resource).toMatchObject(resource);
    expect(currentId()).toBe(initialId);
    expect(captured.isViewerCurrent?.()).toBe(true);
    expect(identities.length).toBeGreaterThan(0);
    expect(identities.every((identity) => identity === initialId)).toBe(true);
  } finally {
    subscription.dispose();
    unsubscribe();
    w.dispose();
  }
});
