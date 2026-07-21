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
  dataRenderers: [],
  treeRenderers: [],
};

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value },
});

const resource = { kind: "ticket", uri: "pstdio://ticket/ticket-1", id: "ticket-1", label: "PS-1" };

describe("registerWorkbenchExtensionFileRenderers", () => {
  test("registers an editable file renderer + view widget and wires load/save commands", async () => {
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
          loadCommandId: "lab.ticket.load",
          saveCommandId: "lab.ticket.save",
        },
      ],
      views: [
        {
          id: "lab.ticketEditor",
          extensionId: "pstdio.lab",
          slotId: "workbench.main",
          target: "workbench.main",
          title: "Ticket",
          role: "location",
          resourceKind: "ticket",
          fileRendererId: "lab.ticketContent",
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
    expect(workbench.layout.getWidget("lab.ticketEditor")).toMatchObject({
      region: "main",
      rendererId: "lab.ticketContent",
      resourceKinds: ["ticket"],
    });

    const loaded = await contribution!.load(resource);
    expect(loaded).toEqual({ fileName: "ticket.md", content: "hello" });
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.ticket.load",
      body: {
        projectId: "project-1",
        resource: { type: "ticket", id: "ticket-1" },
        slot: { id: "lab.ticketContent", kind: "renderer" },
      },
    });

    await contribution!.save!(resource, "new content");
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.ticket.save",
      body: { params: { content: "new content" }, resource: { type: "ticket", id: "ticket-1" } },
    });
  });

  test("omits save for a read-only file renderer (no saveCommandId)", async () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...baseMetadata,
      fileRenderers: [
        { id: "lab.readonly", extensionId: "pstdio.lab", title: "Read only", loadCommandId: "lab.ticket.load" },
      ],
      views: [],
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
