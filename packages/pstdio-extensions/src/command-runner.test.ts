import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RuntimeCommandRecord } from "@pstdio/sdk/extensions";
import {
  createActivityEventsDBService,
  createDb,
  createExtensionStorageDBService,
  createProjectsDBService,
} from "pstdio-db";
import { runExtensionCommand } from "./command-runner";

let close: () => Promise<void>;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let projectId: string;

const createCommand = (overrides: Partial<RuntimeCommandRecord>): RuntimeCommandRecord => ({
  id: "project.lab.inspect",
  key: "inspect",
  extensionId: "project.lab",
  title: "Inspect",
  target: "project",
  menus: [],
  sourcePath: "/tmp/extension.ts",
  run: async () => undefined,
  ...overrides,
});

beforeEach(async () => {
  const connection = await createDb({ path: ":memory:" });
  close = connection.close;
  db = connection.db;
  const project = await createProjectsDBService(db).create({ name: "command-runner" });
  projectId = project.id;
});

afterEach(async () => {
  await close?.();
});

describe("runExtensionCommand", () => {
  test("passes project, target, params, storage, and session APIs to the command", async () => {
    const command = createCommand({
      params: {
        note: { type: "text" },
        count: { type: "text" },
      },
      run: async (ctx) => {
        await ctx.storage.set("lastRun", {
          note: ctx.params.note,
          target: ctx.target,
        });

        const session = await ctx.sessions.create({ title: `Inspect ${ctx.params.note}` });

        return {
          projectId: ctx.projectId,
          target: ctx.target,
          note: ctx.params.note,
          count: ctx.params.count,
          sessionProjectId: (session as { project_id: string }).project_id,
        };
      },
    });

    const target = { type: "project", id: projectId, projectId, label: "Command runner project" };
    const result = await runExtensionCommand({
      commands: [command],
      db,
      projectId,
      commandId: command.id,
      params: { note: "hello", count: 2 },
      target,
    });

    expect(result).toEqual({
      projectId,
      target,
      note: "hello",
      count: 2,
      sessionProjectId: projectId,
    });

    const storage = createExtensionStorageDBService(db);
    expect(
      await storage.get(
        {
          project_id: projectId,
          extension_id: "project.lab",
          scope_type: "project",
          scope_id: "",
        },
        "lastRun",
      ),
    ).toEqual({
      note: "hello",
      target,
    });
  });

  test("passes prompt, anchors, and metadata to the provided session adapter", async () => {
    const target = { type: "workspace", id: "workspace-1", projectId, label: "Workspace 1" };
    const sessionInputs: unknown[] = [];
    const command = createCommand({
      target: "workspace",
      run: async (ctx) =>
        ctx.sessions.create({
          title: "Review workspace",
          prompt: "Review this workspace.",
          anchors: [{ ...ctx.target, role: "primary" }],
          metadata: { source: "command" },
        }),
    });

    const result = await runExtensionCommand({
      commands: [command],
      db,
      projectId,
      commandId: command.id,
      target,
      sessions: {
        create: async (input) => {
          sessionInputs.push(input);
          return { id: "session-1" };
        },
      },
    });

    expect(result).toEqual({ id: "session-1" });
    expect(sessionInputs).toEqual([
      {
        title: "Review workspace",
        prompt: "Review this workspace.",
        anchors: [{ ...target, role: "primary" }],
        metadata: { source: "command" },
      },
    ]);
  });

  test("passes the provided template adapter to commands", async () => {
    const command = createCommand({
      run: async (ctx) => ctx.templates.get("ticket"),
    });

    const result = await runExtensionCommand({
      commands: [command],
      db,
      projectId,
      commandId: command.id,
      templates: {
        get: async (name: string) => ({
          name,
          templateType: "ticket",
          content: "# {{TICKET_TITLE}}",
        }),
      },
    });

    expect(result).toEqual({
      name: "ticket",
      templateType: "ticket",
      content: "# {{TICKET_TITLE}}",
    });
  });

  test("lets commands record activity for extension-owned targets", async () => {
    const target = { type: "project.lab.task", id: "task-1", projectId, label: "Task 1", extensionId: "project.lab" };
    const command = createCommand({
      target: "project.lab.task",
      run: async (ctx) => {
        await ctx.activity.record({
          eventType: "task.inspected",
          summary: "Task inspected",
          related: [{ type: "project", id: ctx.projectId, projectId: ctx.projectId }],
          metadata: { command: "inspect" },
        });
      },
    });

    await runExtensionCommand({
      commands: [command],
      db,
      projectId,
      commandId: command.id,
      target,
    });

    const activity = await createActivityEventsDBService(db).listByResource({
      projectId,
      resourceType: "project.lab.task",
      resourceId: "task-1",
    });

    expect(activity.events).toHaveLength(1);
    expect(activity.events[0].target_ref_json).toEqual(target);
    expect(activity.events[0].related_refs_json).toEqual([{ type: "project", id: projectId, projectId }]);
    expect(activity.events[0].source_extension_id).toBe("project.lab");
    expect(activity.events[0].payload_json).toEqual({ command: "inspect" });
  });

  test("rejects prompt sessions when no session adapter is provided", async () => {
    const command = createCommand({
      run: async (ctx) =>
        ctx.sessions.create({
          title: "Review project",
          prompt: "Review this project.",
        }),
    });

    await expect(
      runExtensionCommand({
        commands: [command],
        db,
        projectId,
        commandId: command.id,
      }),
    ).rejects.toThrow(/session adapter/i);
  });

  test("rejects non-project commands when no target is provided", async () => {
    const command = createCommand({
      target: "workspace",
      run: async () => "unreachable",
    });

    await expect(
      runExtensionCommand({
        commands: [command],
        db,
        projectId,
        commandId: command.id,
      }),
    ).rejects.toThrow(/workspace.*target/i);
  });

  test("wraps command errors with command and extension ids", async () => {
    const command = createCommand({
      run: async () => {
        throw new Error("boom");
      },
    });

    await expect(
      runExtensionCommand({
        commands: [command],
        db,
        projectId,
        commandId: command.id,
      }),
    ).rejects.toThrow(/project\.lab\.inspect.*project\.lab.*boom/);
  });

  test("runs another extension command through the command context", async () => {
    const parent = createCommand({
      id: "project.lab.parent",
      key: "parent",
      run: async (ctx) => ctx.commands.run("project.lab.child", { note: ctx.params.note }),
    });
    const child = createCommand({
      id: "project.lab.child",
      key: "child",
      run: async (ctx) => `child:${ctx.params.note}`,
    });

    await expect(
      runExtensionCommand({
        commands: [parent, child],
        db,
        projectId,
        commandId: parent.id,
        params: { note: "delegated" },
      }),
    ).resolves.toBe("child:delegated");
  });

  test("prevents recursive command execution", async () => {
    const command = createCommand({
      run: async (ctx) => ctx.commands.run("project.lab.inspect"),
    });

    await expect(
      runExtensionCommand({
        commands: [command],
        db,
        projectId,
        commandId: command.id,
      }),
    ).rejects.toThrow(/recursive extension command execution/i);
  });
});
