import { expect, test } from "bun:test";
import type { ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { expectRejection } from "../../test-utils/expect-rejection";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionHarnessOperation, invokeSessionHarnessOperation } from "./session-harness-commands";

test("a failed first-operation workspace link leaves a failed session", async () => {
  const app = await createTestApp();
  try {
    const response = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Failed operation link" })),
    });
    const project = await response.json();
    await expectRejection(
      createSessionHarnessOperation(
        app.deps,
        { project_id: project.id, title: "First operation", agent: "native-test" },
        { kind: "command", text: "/goal" },
        async () => {
          throw new Error("link failed");
        },
      ),
    ).toThrow("link failed");
    const sessions = await app.deps.sessionService.list(project.id);
    expect(sessions.map((session) => session.status)).toEqual(["failed"]);
    expect(app.deps.sessionService.store.get(sessions[0].id)).toBeNull();
  } finally {
    await app.close();
  }
});

test("an unavailable workspace rejects a native operation before creating a session", async () => {
  const app = await createTestApp();
  try {
    const response = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Workspace provisioning" })),
    });
    const project = await response.json();
    const workspace = (await app.deps.workspaceService.getDefault(project.id))!;
    const run = () =>
      createSessionHarnessOperation(
        app.deps,
        {
          project_id: project.id,
          title: "Native operation",
          agent: "native-test",
          workspaceId: workspace.id,
        },
        { kind: "command", text: "/compact" },
        async () => {},
      );
    const finishMaintenance = Promise.withResolvers<void>();
    const maintenance = app.deps.workspaceService.maintenance.run(workspace.id, () => finishMaintenance.promise);
    try {
      await expectRejection(run()).toThrow("Workspace files are being updated");
      expect(await app.deps.sessionService.list(project.id)).toEqual([]);
    } finally {
      finishMaintenance.resolve();
      await maintenance;
    }
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_state: "provisioning",
      execution_kind: workspace.execution_kind,
      root_path: workspace.root_path,
      provider_capabilities_json: workspace.provider_capabilities_json,
      provider_error_json: null,
    });
    await expectRejection(run()).toThrow("provider state is provisioning");
    expect(await app.deps.sessionService.list(project.id)).toEqual([]);
  } finally {
    await app.close();
  }
});

test("a native operation refused after preparation stops the children it started", async () => {
  let child: ProcessHandle | undefined;
  const record = createTestHarnessRecord("native-release", {
    provider: {
      prepareOperation: (ctx) => {
        child = ctx.process.spawn({ command: [process.execPath, "-e", "setInterval(() => {}, 1000)"] });
        return { execution: "exclusive", invoke: async () => ({ kind: "completed" }) };
      },
    },
  });
  const app = await createTestApp({ harnessRegistry: createTestHarnessRegistry([record]) });
  try {
    const project = await (
      await app.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Refused operation" })),
      })
    ).json();
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Busy",
      agent: testHarnessId("native-release"),
    });
    await app.deps.sessionService.resume(session.id);
    await expectRejection(
      invokeSessionHarnessOperation(app.deps, session.id, { kind: "command", text: "/review" }),
    ).toThrow("Finish or stop the current work");
    const outcome = await Promise.race([
      child!.exited.then(() => "stopped"),
      Bun.sleep(3_000).then(() => "still running"),
    ]);
    expect(outcome).toBe("stopped");
  } finally {
    await app.close();
  }
});
