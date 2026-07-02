import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventStore } from "pstdio-api-runtime-host";
import { testHarnessId } from "../../harnesses/test-harness-registry";
import { createSessionHandler } from "./create-session";

const FAKE_ID = testHarnessId("fake");

const readJsonLines = (filePath: string) =>
  readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const waitForLogEntry = async (filePath: string, predicate: (entry: Record<string, unknown>) => boolean) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 1_000) {
    if (existsSync(filePath)) {
      try {
        const entry = readJsonLines(filePath).find(predicate);
        if (entry) return entry;
      } catch {
        // The async file target may expose the file before the full JSON line is flushed.
      }
    }

    await Bun.sleep(20);
  }

  return existsSync(filePath) ? (readJsonLines(filePath).find(predicate) ?? null) : null;
};

const createContext = () => {
  const response: { status: number; body: unknown } = { status: 201, body: null };

  return {
    context: {
      req: {
        valid: () => ({
          project_id: "project-1",
          title: "Session",
          prompt: "Run task",
          agent: FAKE_ID,
          model: "fake-model",
        }),
      },
      json: (jsonBody: unknown, status: number) => {
        response.status = status;
        response.body = jsonBody;
        return response;
      },
    },
    response,
  };
};

const createDeps = () => {
  const transitionStatus = mock(async () => ({ id: "session-1", project_id: "project-1", status: "failed" }));

  return {
    deps: {
      projectService: {
        get: async () => ({ id: "project-1" }),
      },
      repoService: {
        listByProject: async () => [{ path: "/repo" }],
      },
      workspaceService: {
        get: async () => null,
        getByShorthand: async () => null,
      },
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => null,
        link: async () => ({}),
      },
      sessionService: {
        create: async () => ({
          id: "session-1",
          project_id: "project-1",
          status: "in_progress",
          title: "Session",
          agent: FAKE_ID,
        }),
        countActive: mock(async () => 0),
        transitionStatus,
        store: {
          create: mock(() => ({
            eventStore: createEventStore(),
            approvalService: { handleResponse: () => {}, dispose: () => {} },
          })),
          get: mock(() => null),
          setSession: mock(() => {}),
          remove: mock(() => {}),
        },
      },
      settingsService: {
        get: async () => ({ max_concurrent_sessions: null }),
      },
      eventBus: {
        emit: () => {},
      },
      harnessRegistry: {
        get: async () => ({
          listModels: async () => [{ id: "fake-model" }],
          start: async () => {
            throw new Error("startup boom");
          },
        }),
      },
      activityEventsService: {
        create: async () => ({}),
      },
      extensionSettingsDBService: {
        getValue: async () => null,
      },
    } as unknown as Parameters<typeof createSessionHandler>[0],
    transitionStatus,
  };
};

describe("createSessionHandler logging", () => {
  const originalLogPath = process.env.PSTDIO_LOG_PATH;
  const originalLogLevel = process.env.PSTDIO_LOG_LEVEL;
  const tempRoots: string[] = [];

  afterEach(() => {
    if (originalLogPath === undefined) delete process.env.PSTDIO_LOG_PATH;
    else process.env.PSTDIO_LOG_PATH = originalLogPath;

    if (originalLogLevel === undefined) delete process.env.PSTDIO_LOG_LEVEL;
    else process.env.PSTDIO_LOG_LEVEL = originalLogLevel;

    for (const tempRoot of tempRoots.splice(0)) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("logs the startup error when async agent spawn fails", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-session-start-log-test-"));
    tempRoots.push(tempRoot);
    const logPath = join(tempRoot, "logs.jsonl");
    process.env.PSTDIO_LOG_PATH = logPath;
    process.env.PSTDIO_LOG_LEVEL = "info";

    const { deps, transitionStatus } = createDeps();
    const handler = createSessionHandler(deps);
    const { context, response } = createContext();

    await handler(context as never, undefined as never);

    expect(response.status).toBe(201);

    const entry = await waitForLogEntry(logPath, (item) => item.event === "session.spawn.failed");

    expect(entry).toMatchObject({
      component: "sessions",
      event: "session.spawn.failed",
      session_id: "session-1",
      project_id: "project-1",
      agent: FAKE_ID,
      cwd: "/repo",
      model: "fake-model",
    });
    expect((entry?.err as { message?: string } | undefined)?.message).toBe("startup boom");
    expect(transitionStatus).toHaveBeenCalledWith("session-1", "failed");
  });
});
