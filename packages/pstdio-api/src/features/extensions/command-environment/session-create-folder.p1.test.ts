import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { createSessionsApi } from "./sessions";

test("public extension sessions allow optional-cwd chat in a cloud project while requiring a folder for coding", async () => {
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("chat", { provider: { cwdRequirement: "optional" } }),
      createTestHarnessRecord("coder", { provider: { cwdRequirement: "required" } }),
    ]),
  });
  try {
    const project = await handle.deps.projectService.create({ name: "Cloud chat" });
    await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
    const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "CC" } });
    await expect(
      api.create({ title: "Code", prompt: "Hello", harness: { harnessId: testHarnessId("coder") } }),
    ).rejects.toThrow("folder");
    const chat = await api.create({ title: "Chat", prompt: "Hello", harness: { harnessId: testHarnessId("chat") } });
    expect(chat.cwd).toBeNull();
    expect(chat.workspaceId).toBeTruthy();
  } finally {
    await handle.close();
  }
});
