import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionFileRenderers } from "./file-renderer-contributions";

const baseMetadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [
    { id: "lab.ticket.load", extensionId: "pstdio.lab", title: "Load" },
    { id: "lab.ticket.save", extensionId: "pstdio.lab", title: "Save" },
  ],
  diagnostics: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  kanbanRenderers: [],
  treeRenderers: [],
};

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value },
});

const resource = { kind: "ticket", uri: "pstdio://ticket/ticket-1", id: "ticket-1", label: "PS-1" };

describe("registerWorkbenchExtensionFileRenderers", () => {
  test("honors panel placement when registering and opening file-backed panels", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...baseMetadata,
      fileRenderers: [
        {
          id: "lab.ticketContent",
          extensionId: "pstdio.lab",
          title: "Ticket",
          resourceKind: "ticket",
          loadHandlerId: "lab.ticket.load",
        },
      ],
      panels: [
        {
          id: "lab.last",
          extensionId: "pstdio.lab",
          region: "main",
          title: "Last",
          closable: false,
          placement: "last",
          fileRendererId: "lab.ticketContent",
        },
        {
          id: "lab.default",
          extensionId: "pstdio.lab",
          region: "main",
          title: "Default",
          closable: false,
          fileRendererId: "lab.ticketContent",
        },
        {
          id: "lab.first",
          extensionId: "pstdio.lab",
          region: "main",
          title: "First",
          closable: false,
          placement: "first",
          fileRendererId: "lab.ticketContent",
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionFileRenderers({
      executeCommand: async (commandId) => success(commandId, { content: "x" }),
      metadata,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.layout.listPanels().map((panel) => panel.id)).toEqual(["lab.first", "lab.default", "lab.last"]);

    workbench.layout.openPanel("lab.last", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.default", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.first", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "lab.first",
      "lab.default",
      "lab.last",
    ]);
  });

  test("registers an editable file renderer + panel widget and wires load/save commands", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; body: CommandExecuteRequest }[] = [];

    const metadata = {
      ...baseMetadata,
      fileRenderers: [
        {
          id: "lab.ticketContent",
          extensionId: "pstdio.lab",
          title: "Ticket",
          resourceKind: "ticket",
          loadHandlerId: "lab.ticket.load",
          saveHandlerId: "lab.ticket.save",
        },
      ],
      panels: [
        {
          id: "lab.ticketEditor",
          extensionId: "pstdio.lab",
          region: "main",
          title: "Ticket",
          closable: false,
          resourceKind: "ticket",
          fileRendererId: "lab.ticketContent",
          panelMenus: [
            {
              id: "lab.ticketProperties",
              extensionId: "pstdio.lab",
              ownerPanelId: "lab.ticketEditor",
              title: "Properties",
              side: "right",
              controlsRendererId: "lab.ticketProperties",
            },
          ],
        },
      ],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionFileRenderers({
      executeCommand: async (commandId, body) => {
        calls.push({ commandId, body });
        if (commandId === "lab.ticket.load") return success(commandId, { fileName: "ticket.md", content: "hello" });
        return success(commandId, { ok: true });
      },
      metadata,
      projectId: "project-1",
      workbench,
    });

    const contribution = workbench.renderers.getFileRenderer("lab.ticketContent");
    expect(contribution).toMatchObject({ id: "lab.ticketContent", title: "Ticket", resourceKind: "ticket" });
    expect(workbench.layout.getPanel("lab.ticketEditor")).toMatchObject({
      region: "main",
      rendererId: "lab.ticketContent",
      resourceKinds: ["ticket"],
    });
    expect(workbench.layout.getPanel("lab.ticketProperties")).toMatchObject({
      region: "main-right-menu",
      rendererId: "lab.ticketProperties",
    });

    const loaded = await contribution!.load(resource);
    expect(loaded).toEqual({ fileName: "ticket.md", content: "hello" });
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.ticket.load",
      body: {
        projectId: "project-1",
        params: {
          renderer: {
            rendererId: "lab.ticketContent",
            projectId: "project-1",
            resource: { type: "ticket", id: "ticket-1" },
            invocation: { placement: "visible" },
          },
        },
        resource: { type: "ticket", id: "ticket-1" },
        slot: { id: "lab.ticketContent", kind: "renderer" },
      },
    });

    await contribution!.save!(resource, "new content");
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.ticket.save",
      body: {
        params: {
          renderer: {
            rendererId: "lab.ticketContent",
            projectId: "project-1",
            resource: { type: "ticket", id: "ticket-1" },
            invocation: { placement: "visible" },
          },
          content: "new content",
        },
        resource: { type: "ticket", id: "ticket-1" },
      },
    });
  });

  test("omits save for a read-only file renderer (no saveHandlerId)", async () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...baseMetadata,
      fileRenderers: [
        { id: "lab.readonly", extensionId: "pstdio.lab", title: "Read only", loadHandlerId: "lab.ticket.load" },
      ],
      panels: [],
    } satisfies WorkbenchExtensionMetadata;

    registerWorkbenchExtensionFileRenderers({
      executeCommand: async (commandId) => success(commandId, { content: "x" }),
      metadata,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.renderers.getFileRenderer("lab.readonly")?.save).toBeUndefined();
  });
});
