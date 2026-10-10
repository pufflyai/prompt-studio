import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTrackedSessionStore } from "../sessions/session-store.test-utils";
import { createCommandEnvironment } from "./command-environment";

const makeEnabledSources = () => [
  {
    instance: {
      id: "instance-1",
      namespace: "lab",
    },
    installedSource: {
      id: "source-1",
      extension_id: "pstdio.extension-lab",
      source_path: "/fake/extension-lab",
    },
  },
];

const projectContext = { id: "project-1", name: "Project One", shorthand: "PO" };

const makeStorageService = () => ({
  getKv: async () => null,
  setKv: async () => {},
  deleteKv: async () => {},
  getCollectionItem: async () => null,
  listCollection: async () => [],
  setCollectionItem: async () => {},
  deleteCollectionItem: async () => {},
});

const attachmentRoot = mkdtempSync(join(tmpdir(), "command-attachments-"));
afterAll(() => rmSync(attachmentRoot, { recursive: true, force: true }));
const sessionAttachmentFile = (name: string) => {
  const storagePath = join(attachmentRoot, name);
  writeFileSync(storagePath, "Attachment content");
  return {
    id: "file-1",
    project_id: "project-1",
    file_name: name,
    file_kind: "session_attachment",
    storage_path: storagePath,
    mime_type: "text/plain",
    size_bytes: 24,
    hash: null,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
  };
};

interface StartedHarness {
  start: ReturnType<typeof mock>;
  params?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}
// Session-creation deps around one fake harness; `defaults` are the project's stored harness params.
const createSessionEnvironment = (harness: StartedHarness, dispatchEntries: unknown[] = []) => {
  const workspace = {
    id: "workspace",
    project_id: "project-1",
    execution_kind: "local",
    root_path: process.cwd(),
    provider_state: "ready",
  };
  return createCommandEnvironment(
    {
      extensionStorageService: makeStorageService(),
      extensionSettingsDBService: {
        getValue: async () => (harness.defaults ? { value_json: harness.defaults } : null),
      },
      workspaceService: {
        getDefault: async () => workspace,
        get: async () => workspace,
        getByShorthand: async () => null,
      },
      workspaceSessionService: { link: async () => {}, getWorkspaceBySessionId: async () => workspace },
      projectService: {
        get: async () => ({ id: "project-1", default_agent_id: null, default_agent_model: null }),
      },
      fileService: {
        get: async () => sessionAttachmentFile("extension-create.txt"),
      },
      harnessRegistry: {
        get: async () => ({
          start: harness.start,
          listModels: () => [],
          params: harness.params,
          capabilities: async () => ["Attachments"],
        }),
        list: async () => [{ id: "fake-agent" }],
      },
      settingsService: {
        get: async () => ({ max_concurrent_sessions: null }),
      },
      sessionQueueEntriesService: {
        createDispatchStarted: async (input: unknown) => {
          dispatchEntries.push(input);
          return { queue_position: 1 };
        },
      },
      sessionService: {
        create: async (input: Record<string, unknown>) => ({
          id: "session-1",
          project_id: input.project_id,
          title: input.title,
          status: "in_progress",
          agent: input.agent,
          last_selected_model: input.last_selected_model ?? null,
          cwd: input.cwd ?? null,
        }),
        update: async () => null,
        get: async () => ({ id: "session-1", project_id: "project-1", status: "in_progress", agent: "fake-agent" }),
        transitionStatus: async () => null,
        store: createTrackedSessionStore(),
      },
      eventBus: { emit: () => {} },
      activityEventsService: { create: async () => ({}) },
    } as never,
    makeEnabledSources() as never,
    {
      extensionId: "pstdio.extension-lab",
      name: "extension-lab",
      project: projectContext,
      projectId: "project-1",
    },
  );
};
const startedHarness = () =>
  mock((_input: unknown) => ({
    agentSessionId: "agent-session-1",
    done: new Promise(() => {}),
    stop: () => {},
  }));
const firstStart = async (start: ReturnType<typeof mock>) => {
  for (let attempt = 0; attempt < 20 && start.mock.calls.length === 0; attempt += 1) {
    await Bun.sleep(0);
  }
  return start.mock.calls[0]?.[0];
};

describe("createCommandEnvironment sessions listByWorkspace", () => {
  test("lists sessions linked to a workspace through the workspace-session join", async () => {
    const listByWorkspace = mock(async () => [
      {
        id: "session-1",
        project_id: "project-1",
        title: "Implement ticket: PS-1",
        status: "completed",
        created_at: "2026-06-17T00:00:00.000Z",
        updated_at: "2026-06-17T01:00:00.000Z",
        anchors_json: [{ type: "ticket", id: "ticket-1" }],
      },
      {
        id: "session-2",
        project_id: "project-1",
        title: "Code review: PS-1",
        status: "in_progress",
        created_at: "2026-06-17T02:00:00.000Z",
        updated_at: "2026-06-17T02:30:00.000Z",
        anchors_json: null,
      },
    ]);
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        workspaceService: {
          getDefault: async () => null,
          get: async () => ({ id: "workspace-1", project_id: "project-1" }),
          getByShorthand: async () => null,
        },
        workspaceSessionService: { listByWorkspace },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    const sessions = await env.sessions.listByWorkspace("workspace-1");

    expect(listByWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(sessions).toMatchObject([
      {
        id: "session-1",
        title: "Implement ticket: PS-1",
        status: "completed",
        created_at: "2026-06-17T00:00:00.000Z",
        updated_at: "2026-06-17T01:00:00.000Z",
        anchors_json: [{ type: "ticket", id: "ticket-1" }],
      },
      {
        id: "session-2",
        title: "Code review: PS-1",
        status: "in_progress",
        created_at: "2026-06-17T02:00:00.000Z",
        updated_at: "2026-06-17T02:30:00.000Z",
        anchors_json: [],
      },
    ]);
  });
});

describe("createCommandEnvironment sessions attachments", () => {
  test("forwards attachment refs from extension-created sessions", async () => {
    const dispatchEntries: unknown[] = [];
    const start = startedHarness();
    const env = createSessionEnvironment({ start }, dispatchEntries);

    await env.sessions.create({
      title: "Extension attachment session",
      prompt: "Use extension attachment",
      attachments: [{ file_id: "file-1" }],
    });

    expect(dispatchEntries[0]).toMatchObject({
      session_id: "session-1",
      request_kind: "start",
      attachments_json: [{ file_id: "file-1" }],
    });
    expect(await firstStart(start)).toMatchObject({
      attachments: [expect.objectContaining({ fileId: "file-1", fileName: "extension-create.txt" })],
    });
  });

  test("starts extension-created sessions with the chosen model options over the project defaults", async () => {
    const start = startedHarness();
    const effort = {
      type: "select",
      defaultValue: "medium",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    };
    const env = createSessionEnvironment({
      start,
      params: { effort, fast: { type: "boolean", defaultValue: false } },
      defaults: { fast: true },
    });

    await env.sessions.create({
      title: "Research",
      prompt: "Research",
      harness: { harnessId: "fake-agent", params: { effort: "high" } },
    });

    expect(await firstStart(start)).toMatchObject({ params: { effort: "high", fast: true } });
  });

  test("rejects model options the harness does not declare", async () => {
    const env = createSessionEnvironment({ start: startedHarness(), params: {} });
    await expect(
      env.sessions.create({ title: "Research", harness: { harnessId: "fake-agent", params: { effort: "high" } } }),
    ).rejects.toThrow();
  });

  test("forwards attachment refs from extension follow-ups", async () => {
    const inserted: unknown[] = [];
    const session = {
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      agent: "fake",
      agent_session_id: "agent-session-1",
      cwd: "/repo",
      last_selected_model: null,
    };
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        fileService: {
          get: async () => sessionAttachmentFile("extension-follow-up.txt"),
        },
        harnessRegistry: {
          get: async () => ({ capabilities: async () => ["Attachments"] }),
        },
        sessionService: {
          get: async () => session,
          insertEntryForActive: async (input: unknown) => {
            inserted.push(input);
            return { queue_position: 1 };
          },
          store: { get: () => null },
        },
      } as never,
      makeEnabledSources() as never,
      {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        project: projectContext,
        projectId: "project-1",
      },
    );

    await env.sessions.followup({
      sessionId: "session-1",
      prompt: "continue",
      attachments: [{ file_id: "file-1" }],
    });

    expect(inserted[0]).toMatchObject({
      id: "session-1",
      prompt: "continue",
      request_kind: "follow_up",
      attachments_json: [{ file_id: "file-1" }],
    });
  });
});
