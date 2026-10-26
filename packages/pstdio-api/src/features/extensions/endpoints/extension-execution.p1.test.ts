import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

test("host execution controls report shared projects, stop a loop and recover persisted data", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-execution-controls-"));
  const previous = {
    PSTDIO_HOME: process.env.PSTDIO_HOME,
    PSTDIO_DEFAULT_EXTENSIONS: process.env.PSTDIO_DEFAULT_EXTENSIONS,
    PSTDIO_EXTENSION_PROCESS_OWNERS: process.env.PSTDIO_EXTENSION_PROCESS_OWNERS,
  };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_EXTENSION_PROCESS_OWNERS = "1";
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    const sourcePath = createTestExtensionSource({
      root,
      name: "controlled",
      installName: "controlled",
      displayName: "Controlled",
    });
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default { commands: [{
      id: 'work', ref: { kind: 'command', id: 'work' }, title: 'Work', run: async (ctx, input) => {
        if (input.loop) { await ctx.storage.set('saved', ctx.projectId); while (true) {} }
        return await ctx.storage.get('saved');
      }
    }] };`,
    );
    handle = await createTestApp({ storageRoot: join(root, "storage") });
    const post = async (path: string, body: unknown = {}) =>
      handle!.app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const first = await (await post("/v1/projects", folderProjectInput({ name: "First" }))).json();
    const second = await (await post("/v1/projects", folderProjectInput({ name: "Second" }))).json();
    const enable = async (projectId: string) => {
      const response = await post(`/v1/projects/${projectId}/extensions/installed/controlled/enable`, {
        displayName: "Controlled",
        extensionId: "test.controlled",
        manifest: { id: "test.controlled", name: "controlled" },
        name: "controlled",
        sourceHash: null,
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.0.0",
      });
      expect(response.status).toBe(200);
      return { id: (await response.json()).instanceId };
    };
    const instance = await enable(first.id);
    await enable(second.id);
    const base = `/v1/projects/${first.id}/extensions/${instance.id}/execution`;
    const statusResponse = await handle.app.request(base);
    expect(statusResponse.status).toBe(200);
    const status = await statusResponse.json();
    expect(status.available).toBe(true);
    expect(status.stopped).toBe(false);
    expect(status.affectedProjects.map((project: { id: string }) => project.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect((await handle.app.request(`/v1/projects/${second.id}/extensions/${instance.id}/execution`)).status).toBe(
      404,
    );

    const looping = post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`, {
      params: { loop: true },
    });
    const settled = looping.then((response) => response.json());
    // Observe the real host write before Stop; cancellation cannot roll it back.
    let saved = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const value = await handle.deps.extensionStorageService.getKv(
        {
          extension_instance_id: instance.id,
          scope_type: "project",
          scope_id: first.id,
        },
        "saved",
      );
      if (value?.value_json === first.id) {
        saved = true;
        break;
      }
      await Bun.sleep(5);
    }
    expect(saved).toBe(true);
    const stopped = await post(base, { action: "stop" });
    expect(stopped.status).toBe(200);
    expect((await stopped.json()).stopped).toBe(true);
    expect((await settled).outcome.ok).toBe(false);
    expect((await handle.app.request("/v1/projects")).status).toBe(200);
    const blocked = await (
      await post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`)
    ).json();
    expect(blocked.outcome.ok).toBe(false);
    expect((await (await handle.app.request(base)).json()).stopped).toBe(true);
    expect((await post(base, { action: "restart" })).status).toBe(200);
    const recovered = await (
      await post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`)
    ).json();
    expect(recovered.outcome).toMatchObject({ ok: true, value: first.id });
    const enabled = await handle.deps.extensionService.getProjectExtensionInstance(first.id, instance.id);
    expect(enabled?.instance.enabled).toBe(true);

    const adopted = await handle.deps.extensionRuntimeCatalog.get(first.id);
    writeFileSync(join(sourcePath, "extension.ts"), "throw new Error('invalid candidate'); export default {};\n");
    const failedReload = await post(`/v1/projects/${first.id}/extensions/${instance.id}/reload`);
    expect(failedReload.status).toBe(200);
    expect((await failedReload.json()).status).toBe("error");
    const retained = await handle.deps.extensionRuntimeCatalog.get(first.id);
    expect(retained.generation).toBe(adopted.generation);
    expect(retained.runtime.commands[0]?.run).toBe(adopted.runtime.commands[0]?.run);
    const stillWorking = await (
      await post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`)
    ).json();
    expect(stillWorking.outcome).toMatchObject({ ok: true, value: first.id });

    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default { commands: [{
      id: 'work', ref: { kind: 'command', id: 'work' }, title: 'Work', run: () => 'repaired'
    }] };`,
    );
    const repaired = await post(`/v1/projects/${first.id}/extensions/${instance.id}/reload`);
    expect((await repaired.json()).status).toBe("loaded");
    const replacement = await handle.deps.extensionRuntimeCatalog.get(first.id);
    expect(replacement.generation).toBeGreaterThan(retained.generation);
    expect(
      (await (await post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`)).json())
        .outcome,
    ).toMatchObject({ ok: true, value: "repaired" });

    writeFileSync(join(sourcePath, "extension.ts"), "while (true) {}; export default {};\n");
    const importing = post(`/v1/projects/${first.id}/extensions/${instance.id}/reload`);
    let initializing = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const inspection = await (await handle.app.request(base)).json();
      if (inspection.owners.some((owner: { state: string }) => owner.state === "starting")) {
        initializing = true;
        break;
      }
      await Bun.sleep(5);
    }
    expect(initializing).toBe(true);
    expect((await post(base, { action: "stop" })).status).toBe(200);
    expect((await (await importing).json()).status).toBe("error");
    expect((await handle.deps.extensionRuntimeCatalog.get(first.id)).generation).toBe(replacement.generation);
    expect((await post(base, { action: "restart" })).status).toBe(200);
    expect(
      (await (await post(`/v1/projects/${first.id}/extensions/commands/test.controlled.command.work/execute`)).json())
        .outcome,
    ).toMatchObject({ ok: true, value: "repaired" });
  } finally {
    await handle?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
