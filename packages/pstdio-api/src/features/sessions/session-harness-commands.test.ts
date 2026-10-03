import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createSessionHarnessOperation } from "./session-harness-commands";

test("a failed first-operation workspace link leaves a failed session", async () => {
  const app = await createTestApp();
  try {
    const response = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Failed operation link" })),
    });
    const project = await response.json();
    await expect(
      createSessionHarnessOperation(
        app.deps,
        { project_id: project.id, title: "First operation", agent: "native-test" },
        { kind: "command", text: "/goal" },
        async () => {
          throw new Error("link failed");
        },
      ),
    ).rejects.toThrow("link failed");
    const sessions = await app.deps.sessionService.list(project.id);
    expect(sessions.map((session) => session.status)).toEqual(["failed"]);
    expect(app.deps.sessionService.store.get(sessions[0].id)).toBeNull();
  } finally {
    await app.close();
  }
});
