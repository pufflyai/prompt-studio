import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createDeviceCommandExecutor } from "./device-command-executor";

test("an authenticated project device can read capacity without changing another device's limit", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Device capacity" });
    await app.deps.workspaceCapacityService.update({ limit: 3 });
    const execute = createDeviceCommandExecutor(app.deps, project.id);
    const signal = new AbortController().signal;
    expect(await execute({ type: "workspace.capacity" }, { signal })).toMatchObject({
      status: 200,
      body: { activeCount: 0, limit: 3 },
    });
    await expectRejection(execute({ type: "workspace.capacity", limit: 99 }, { signal })).toThrow();
    expect((await app.deps.workspaceCapacityService.get()).limit).toBe(3);
    expect(
      await createDeviceCommandExecutor(app.deps, "missing-project")({ type: "workspace.capacity" }, { signal }),
    ).toMatchObject({ status: 404 });
    const cancelled = AbortSignal.abort(new Error("Device disconnected"));
    await expectRejection(execute({ type: "workspace.capacity" }, { signal: cancelled })).toThrow(
      "Device disconnected",
    );
  } finally {
    await app.close();
  }
});
