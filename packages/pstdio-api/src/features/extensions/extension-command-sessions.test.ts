import { describe, expect, mock, test } from "bun:test";
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

const sessionAttachmentFile = (name: string) => ({
  id: "file-1",
  project_id: "project-1",
  file_name: name,
  file_kind: "session_attachment",
  storage_path: `/tmp/${name}`,
  mime_type: "text/plain",
  size_bytes: 24,
  hash: null,
  created_at: "2026-06-17T00:00:00.000Z",
  updated_at: "2026-06-17T00:00:00.000Z",
});

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
    expect(sessions).toEqual([
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
    const start = mock((_input: unknown) => ({
      agentSessionId: "agent-session-1",
      done: new Promise(() => {}),
      stop: () => {},
    }));
    const env = createCommandEnvironment(
      {
        extensionStorageService: makeStorageService(),
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: "/repo" }],
        },
        workspaceService: {
          get: async () => null,
          getByShorthand: async () => null,
        },
        projectService: {
          get: async () => ({ id: "project-1", default_agent_id: null, default_agent_model: null }),
        },
        fileService: {
          get: async () => sessionAttachmentFile("extension-create.txt"),
        },
        harnessRegistry: {
          get: async () => ({ start, listModels: () => [] }),
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
          get: async () => null,
          transitionStatus: async () => null,
          store: {
            create: mock(() => ({
              eventStore: {
                push: () => {},
                getHistory: () => [],
                subscribe: async function* () {},
              },
              approvalService: { handleResponse: () => {}, dispose: () => {} },
              submittedAttachmentFileIds: new Set<string>(),
            })),
            get: mock(() => null),
            setSession: mock(() => true),
            remove: mock(() => {}),
          },
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
    for (let attempt = 0; attempt < 20 && start.mock.calls.length === 0; attempt += 1) {
      await Bun.sleep(0);
    }
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      attachments: [expect.objectContaining({ fileId: "file-1", fileName: "extension-create.txt" })],
    });
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
        sessionService: {
          get: async () => session,
          insertEntryForActive: async (input: unknown) => {
            inserted.push(input);
            return { queue_position: 1 };
          },
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
