import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { type CommandFilesParamValue, createCommandFilesParamValue } from "@pstdio/workbench/react";
import { createExtensionMenuCommandHandler } from "./extension-command-handler";

const successResponse = {
  outcome: { ok: true, status: "success", value: {} },
} as unknown as CommandExecuteResponse;

const baseContribution = {
  id: "pstdio-planner.run-attempt.menu.0",
  commandId: "pstdio-planner.run-attempt",
  slotId: "ticket.headerPrimary",
} as unknown as ExtensionMenuContribution;

const createHandler = (input: {
  contribution: ExtensionMenuContribution;
  onBody: (body: unknown) => void;
  uploadFile?: (file: File) => Promise<{ id: string }>;
}) =>
  createExtensionMenuCommandHandler({
    ctx: {} as unknown as WorkbenchModuleContext,
    contribution: input.contribution,
    executeCommand: async (_projectId, _commandId, body) => {
      input.onBody(body);
      return successResponse;
    },
    getActiveResource: () => undefined,
    projectId: "project-1",
    uploadFile: async (_projectId, _commandId, file) =>
      input.uploadFile?.(file) ?? Promise.resolve({ id: `ref-${file.name}` }),
  });

describe("extension menu command handler", () => {
  test("forwards collected args as params merged with contribution params", async () => {
    let body: { params?: unknown } | undefined;
    const handler = createHandler({
      contribution: { ...baseContribution, params: { template: "refine-ticket" } } as ExtensionMenuContribution,
      onBody: (value) => {
        body = value as { params?: unknown };
      },
    });

    await handler.execute({ agent: { harnessId: "opencode", model: "gpt-5" } });

    expect(body?.params).toEqual({
      template: "refine-ticket",
      agent: { harnessId: "opencode", model: "gpt-5" },
    });
  });

  test("omits params when the action has neither contribution params nor collected args", async () => {
    let body: { params?: unknown } | undefined;
    const handler = createHandler({
      contribution: baseContribution,
      onBody: (value) => {
        body = value as { params?: unknown };
      },
    });

    await handler.execute(undefined);

    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("params");
  });

  test("uses the command execution resource before the active resource", async () => {
    let body: { resource?: { type?: string; id?: string } } | undefined;
    const activeTicket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-1",
      id: "PS-1",
      label: "PS-1",
    } satisfies ResourceRef;
    const rowWorkspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
    } satisfies ResourceRef;
    const handler = createExtensionMenuCommandHandler({
      ctx: {} as unknown as WorkbenchModuleContext,
      contribution: baseContribution,
      executeCommand: async (_projectId, _commandId, value) => {
        body = value as { resource?: { type?: string; id?: string } };
        return successResponse;
      },
      getActiveResource: () => activeTicket,
      projectId: "project-1",
    });

    await handler.execute(undefined, { resource: rowWorkspace });

    expect(body?.resource).toMatchObject({ type: "workspace", id: "ws-1" });
  });

  test("uploads pending files before execution and replaces them with refs", async () => {
    const events: string[] = [];
    let body: { params?: { files?: unknown } } | undefined;
    const first = new File(["first"], "first.csv", { type: "text/csv" });
    const second = new File(["second"], "second.csv", { type: "text/csv" });
    const handler = createExtensionMenuCommandHandler({
      ctx: {} as unknown as WorkbenchModuleContext,
      contribution: baseContribution,
      executeCommand: async (_projectId, _commandId, value) => {
        events.push("execute");
        body = value as { params?: { files?: unknown } };
        return successResponse;
      },
      getActiveResource: () => undefined,
      projectId: "project-1",
      uploadFile: async (_projectId, _commandId, file) => {
        events.push(`upload:${file.name}`);
        return { id: `ref-${file.name}` };
      },
    });

    await handler.execute({
      files: createCommandFilesParamValue({
        refs: ["existing-ref"],
        uploads: [
          { id: "first", file: first, status: "queued" },
          { id: "second", file: second, status: "queued" },
        ],
      }),
    });

    expect(events).toEqual(["upload:first.csv", "upload:second.csv", "execute"]);
    expect(body?.params?.files).toEqual(["existing-ref", "ref-first.csv", "ref-second.csv"]);
  });

  test("preserves preset refs without uploading them again", async () => {
    let body: { params?: { files?: unknown } } | undefined;
    let uploads = 0;
    const handler = createHandler({
      contribution: baseContribution,
      onBody: (value) => {
        body = value as { params?: { files?: unknown } };
      },
      uploadFile: async () => {
        uploads += 1;
        return { id: "unexpected" };
      },
    });

    await handler.execute({ files: createCommandFilesParamValue({ refs: ["existing-ref"] }) });

    expect(uploads).toBe(0);
    expect(body?.params?.files).toEqual(["existing-ref"]);
  });

  test("reports upload states and reuses completed uploads after a later failure", async () => {
    const first = new File(["first"], "first.csv", { type: "text/csv" });
    const second = new File(["second"], "second.csv", { type: "text/csv" });
    const reports: CommandFilesParamValue[] = [];
    let attempts = 0;
    const handler = createHandler({
      contribution: baseContribution,
      onBody: () => undefined,
      uploadFile: async (file) => {
        attempts += 1;
        if (file === second && attempts === 2) throw new Error("upload failed");
        return { id: `ref-${file.name}` };
      },
    });
    const args = {
      files: createCommandFilesParamValue({
        uploads: [
          { id: "first", file: first, status: "queued" },
          { id: "second", file: second, status: "queued" },
        ],
      }),
    };

    await expect(
      handler.prepareArgs?.(args, undefined, (next) => {
        reports.push((next as { files: CommandFilesParamValue }).files);
      }),
    ).rejects.toThrow("upload failed");

    expect(reports.at(-1)?.uploads.map((upload) => upload.status)).toEqual(["complete", "error"]);
    expect(reports.at(-1)?.uploads[0]?.ref).toBe("ref-first.csv");

    const prepared = await handler.prepareArgs?.(reports.at(-1) ? { files: reports.at(-1) } : args);
    expect((prepared as { files: string[] }).files).toEqual(["ref-first.csv", "ref-second.csv"]);
    expect(attempts).toBe(3);
  });

  test("does not execute the command after an upload failure", async () => {
    let executions = 0;
    const file = new File(["first"], "first.csv", { type: "text/csv" });
    const handler = createExtensionMenuCommandHandler({
      ctx: {} as unknown as WorkbenchModuleContext,
      contribution: baseContribution,
      executeCommand: async () => {
        executions += 1;
        return successResponse;
      },
      getActiveResource: () => undefined,
      projectId: "project-1",
      uploadFile: async () => {
        throw new Error("upload failed");
      },
    });

    await expect(
      handler.execute({
        files: createCommandFilesParamValue({ uploads: [{ id: "first", file, status: "queued" }] }),
      }),
    ).rejects.toThrow("upload failed");
    expect(executions).toBe(0);
  });
});
