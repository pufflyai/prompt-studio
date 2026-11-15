import { expect, test } from "bun:test";
import type { ApprovalResponse } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

test("a session's first turn can ask for tool approval", async () => {
  const asked = Promise.withResolvers<void>();
  const answered = Promise.withResolvers<ApprovalResponse | "no channel">();
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("first-turn-approval", {
        provider: {
          start: (_ctx, input) => {
            const done = (async () => {
              if (!input.approvals) {
                answered.resolve("no channel");
                return { status: "completed" as const };
              }
              const approval = input.approvals.requestApproval({
                id: "approval",
                toolName: "write",
                toolInput: { path: "a.txt" },
                toolUseId: "tool",
              });
              asked.resolve();
              answered.resolve(await approval);
              return { status: "completed" as const };
            })();
            return { agentSessionId: "native", done, stop: () => {} };
          },
        },
      }),
    ]),
  });
  const post = (path: string, body: unknown) =>
    app.app.request(`/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Approvals" }))).json();
    const created = await post("/sessions", {
      project_id: project.id,
      title: "Approvals",
      prompt: "Write a.txt",
      agent: testHarnessId("first-turn-approval"),
    });
    expect(created.status).toBe(201);
    const session = await created.json();
    await Promise.race([asked.promise, answered.promise]);
    expect((await post(`/sessions/${session.id}/approve`, { id: "approval", decision: "approve" })).status).toBe(200);
    expect(await answered.promise).toEqual({ id: "approval", decision: "approve" });
  } finally {
    await app.close();
  }
});
