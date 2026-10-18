import { expect, test } from "bun:test";
import type { CommandExecutionResult } from "@pstdio/sdk/api";
import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { watchOpenExtensionResource } from "./extension-resource-sync";

const projectId = "document-resolution";
const extensionId = "acme.planner";
const ticketPage = { kind: "page" as const, extensionId, id: "ticket" };
const ticketsPage = { kind: "page" as const, extensionId, id: "tickets" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const fileResource = (id: string): ResourceRef => ({
  type: "ticket",
  id: "t1",
  extensionId,
  projectId,
  metadata: { documentId: id },
});
const fileTarget = (resource: ResourceRef, name: string): NavigationTargetPage => ({
  kind: "page",
  page: ticketPage,
  resource: { ...resource, label: name, icon: "file-text" },
  parent: {
    kind: "page",
    page: ticketPage,
    resource: { type: "ticket", id: "t1", extensionId, projectId, label: "T-1 Ticket" },
    parent: { kind: "page", page: ticketsPage },
  },
});
const setup = (resolve: (resource: ResourceRef) => Promise<NavigationTargetPage> | NavigationTargetPage) => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  for (const ref of [ticketsPage, ticketPage]) {
    workbench.pages.registerPage({
      id: ref.id,
      ref,
      title: ref.id,
      path: ref.id,
      modeId: "project",
      ...(ref === ticketPage
        ? {
            parentId: ticketsPage.id,
            document: { metadataKey: "documentId" },
            params: { view: { type: "string" as const } },
            resource: { kinds: [{ kind: "resource-kind", id: "ticket", extensionId }] },
          }
        : {}),
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
  }
  const calls: ResourceRef[] = [];
  const subscription = watchOpenExtensionResource(workbench, {
    projectId,
    metadata: {
      resourceKinds: [
        {
          id: "ticket",
          localId: "ticket",
          extensionId,
          resolveManyCommand: `${extensionId}.command.resolve-tickets`,
          menuSlots: [],
        },
      ],
    },
    executeCommand: async (_project, commandId, body) => {
      const resource = (body as { params: { resources: ResourceRef[] } }).params.resources[0]!;
      calls.push(resource);
      const target = resource.metadata?.documentId
        ? await resolve(resource)
        : {
            kind: "page" as const,
            page: ticketPage,
            resource: { ...resource, label: "T-1 Ticket" },
            parent: { kind: "page" as const, page: ticketsPage },
          };
      return {
        commandId,
        extensionId,
        outcome: { ok: true, status: "success", value: [{ resource: target.resource, target }] },
      } as CommandExecutionResult;
    },
  });
  workbench.pageLocations.setProject(projectId);
  const open = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: ticketPage, resource: fileResource(id) });
  return { workbench, open, calls, subscription };
};

test("a document link with identity only resolves its filename and ticket ancestry", async () => {
  const { workbench, open, calls, subscription } = setup((resource) => fileTarget(resource, "notes.md"));
  try {
    open("notes");
    await settle();
    expect(calls.filter((resource) => resource.metadata?.documentId)).toHaveLength(1);
    expect(workbench.pages.store.getState().location).toMatchObject({
      resource: { label: "notes.md", metadata: { documentId: "notes" } },
      parent: { resource: { id: "t1", label: "T-1 Ticket" }, parent: { page: ticketsPage } },
    });
  } finally {
    subscription.dispose();
  }
});

test("renaming an open file refreshes its label without changing its document or source position", async () => {
  let name = "notes.md";
  const { workbench, open, subscription } = setup((resource) => fileTarget(resource, name));
  try {
    open("notes");
    await settle();
    workbench.pageLocations.navigate({
      kind: "page",
      page: ticketPage,
      resource: fileResource("notes"),
      position: { line: 3 },
      params: { view: "raw" },
    });
    name = "renamed.md";
    publishExtensionEvent({ id: `${extensionId}.event.changed`, projectId });
    await settle();
    expect(workbench.pages.store.getState().location).toMatchObject({
      resource: { label: "renamed.md", metadata: { documentId: "notes" } },
      position: { line: 3 },
      params: { view: "raw" },
      parent: { resource: { label: "T-1 Ticket" } },
    });
  } finally {
    subscription.dispose();
  }
});

test("switching documents on one ticket resolves the new document and drops a late previous result", async () => {
  let finishFirst: (target: NavigationTargetPage) => void = () => undefined;
  const { workbench, open, calls, subscription } = setup((resource) =>
    resource.metadata?.documentId === "first"
      ? new Promise((resolve) => {
          finishFirst = resolve;
        })
      : fileTarget(resource, "second.md"),
  );
  try {
    open("first");
    await settle();
    open("second");
    await settle();
    finishFirst(fileTarget(fileResource("first"), "first.md"));
    await settle();
    expect(calls.filter((resource) => resource.metadata?.documentId)).toHaveLength(2);
    expect(workbench.getPrimaryResource()).toMatchObject({ label: "second.md", metadata: { documentId: "second" } });
  } finally {
    subscription.dispose();
  }
});

test("owner targets cannot move the open page or switch its selected document", async () => {
  for (const destination of ["another-page", "another-document"]) {
    const { workbench, open, subscription } = setup((resource) => {
      const target = fileTarget(resource, "notes.md");
      if (destination === "another-page") return { ...target, page: { ...ticketPage, id: "other" } };
      return { ...target, resource: fileResource("other") };
    });
    try {
      open("notes");
      await settle();
      expect(workbench.pages.store.getState().location).toMatchObject({
        page: ticketPage,
        resource: { metadata: { documentId: "notes" } },
        parent: { page: ticketsPage },
      });
    } finally {
      subscription.dispose();
    }
  }
});

test("each document on the same resource refreshes its own title and keeps its selector", async () => {
  let suffix = "";
  const { workbench, open, calls, subscription } = setup((resource) =>
    fileTarget(resource, `${resource.metadata?.documentId ?? "ticket"}${suffix}.md`),
  );
  const panel = { kind: "placement" as const, extensionId, id: "files" };
  workbench.modePlacements.registerPlacement({
    id: "files",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "ticket", extensionId }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
      },
    },
  });
  try {
    open("first");
    await settle();
    workbench.modePlacements.openPlacement({ panel, resource: fileResource("second"), open: "pin" });
    await settle();
    const selected = workbench.layout.getLayout().activeWidgetId;
    suffix = "-renamed";
    calls.length = 0;
    publishExtensionEvent({ id: `${extensionId}.event.changed`, projectId });
    await settle();
    expect(workbench.getPrimaryResource()).toMatchObject({
      label: "first-renamed.md",
      metadata: { documentId: "first" },
    });
    expect(workbench.layout.getLayout().regions.side.widgets[0]?.resource).toMatchObject({
      label: "second-renamed.md",
      metadata: { documentId: "second" },
    });
    expect(workbench.pages.store.getState().location?.parent?.resource?.metadata?.documentId).toBeUndefined();
    expect(calls.some((resource) => resource.metadata?.documentId === "second")).toBe(true);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(selected);
  } finally {
    subscription.dispose();
  }
});
