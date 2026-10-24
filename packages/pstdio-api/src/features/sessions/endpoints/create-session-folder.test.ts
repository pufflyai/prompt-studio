import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";

const pendingSession = (): HarnessSession => ({
  agentSessionId: `agent-${crypto.randomUUID()}`,
  done: new Promise<HarnessExit>(() => {}),
  stop: () => {},
});
const startCoder = mock(() => pendingSession());
const startChat = mock(() => pendingSession());

let handle: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("coder", { provider: { start: startCoder, getMessages: () => [] } }),
      createTestHarnessRecord("chat", {
        provider: { cwdRequirement: "optional", start: startChat, getMessages: () => [] },
      }),
    ]),
  });
});
afterAll(async () => {
  await handle.close();
});

const createSession = (projectId: string, agent: string) =>
  handle.app.request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, title: "Hello", agent, prompt: "Hello" }),
  });

test("a session that works on files asks for the project's folder on a device without one", async () => {
  // A cloud project from another device has its data here but no folder yet.
  const project = await handle.deps.projectService.create({ name: "Cloud notes" });
  await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });

  const coding = await createSession(project.id, testHarnessId("coder"));
  expect(coding.status).toBe(409);
  expect(await coding.json()).toEqual({
    error: new ProjectFolderMissingError().message,
    code: "project_folder_missing",
  });
  expect(startCoder).not.toHaveBeenCalled();

  // A harness that needs no folder still starts, without a working folder.
  expect((await createSession(project.id, testHarnessId("chat"))).status).toBe(201);
  while (startChat.mock.calls.length === 0) await Bun.sleep(10);
  const [start] = startChat.mock.calls[0] as unknown as [{ cwd?: string; workspace?: unknown }];
  expect([start.cwd, start.workspace]).toEqual([undefined, undefined]);
});
