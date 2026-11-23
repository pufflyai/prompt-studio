import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { expectRejection } from "../../../test-utils/expect-rejection";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { createSessionsApi } from "./sessions";

test("public extension sessions allow optional-cwd chat in a cloud project while requiring a folder for coding", async () => {
  let catalogAvailable = false;
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("chat", {
        provider: {
          cwdRequirement: "optional",
          async listModels() {
            if (!catalogAvailable) throw new Error("Model catalog unavailable");
            return [];
          },
        },
      }),
      createTestHarnessRecord("coder", { provider: { cwdRequirement: "required" } }),
    ]),
  });
  try {
    const project = await handle.deps.projectService.create({ name: "Cloud chat" });
    await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });
    const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "CC" } });
    await expectRejection(
      api.create({ title: "Code", prompt: "Hello", harness: { harnessId: testHarnessId("coder") } }),
    ).toThrow("folder");
    const chatInput = { title: "Chat", prompt: "Hello", harness: { harnessId: testHarnessId("chat") } };
    await expectRejection(api.create(chatInput)).toMatchObject({
      name: "SessionCreateRefused",
      message: "Model catalog unavailable",
    });
    expect((await api.query({ limit: 10 })).items).toEqual([]);
    catalogAvailable = true;
    const chat = await api.create(chatInput);
    expect(chat.cwd).toBeNull();
    expect(chat.workspaceId).toBeTruthy();
  } finally {
    await handle.close();
  }
});
