import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("owner commands use real host storage while unrelated project reads progress", async () => {
  const root = mkdtempSync(join(tmpdir(), "owner-api-"));
  const saved = {
    home: process.env.PSTDIO_HOME,
    defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS,
    owners: process.env.PSTDIO_EXTENSION_PROCESS_OWNERS,
  };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_EXTENSION_PROCESS_OWNERS = "1";
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    const sourcePath = createTestExtensionSource({ root, name: "owner", installName: "owner", displayName: "Owner" });
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default { commands: [{
      id: 'compute', ref: { kind: 'command', id: 'compute' }, title: 'Compute', mutating: true,
      run: async (ctx) => {
        const id = ctx.storage.ids.create('item');
        const position = ctx.storage.positions.between();
        await ctx.storage.set('started', true);
        const end = Date.now() + 150; while (Date.now() < end) {};
        await ctx.storage.scope({ type: 'project' }).set('result', { id, position, projectId: ctx.projectId });
        return { id, position, projectId: ctx.projectId, pid: process.pid };
      }
    }, { id: 'read', ref: { kind: 'command', id: 'read' }, title: 'Read', run: async (ctx) => ctx.storage.get('result') }] };`,
    );
    handle = await createTestApp({ storageRoot: join(root, "storage") });
    const post = async (path: string, body: unknown) => {
      const response = await handle!.app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      return response.json();
    };
    const project = await post("/v1/projects", folderProjectInput({ name: "Owner Project" }));
    await post(`/v1/projects/${project.id}/extensions/installed/owner/enable`, {
      displayName: "Owner",
      extensionId: "test.owner",
      manifest: { id: "test.owner", name: "owner" },
      name: "owner",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: "0.0.0",
    });
    let completed = false;
    let progress = 0;
    const computing = post(
      `/v1/projects/${project.id}/extensions/commands/test.owner.command.compute/execute`,
      {},
    ).finally(() => {
      completed = true;
    });
    while (!completed) {
      const response = await handle.app.request("/v1/projects");
      expect(response.status).toBe(200);
      if (!completed) progress++;
      await Bun.sleep(5);
    }
    const result = await computing;
    expect(result.outcome.ok).toBe(true);
    expect(result.outcome.value.pid).not.toBe(process.pid);
    expect(typeof result.outcome.value.id).toBe("string");
    expect(typeof result.outcome.value.position).toBe("string");
    expect(progress).toBeGreaterThan(0);
    const persisted = await post(`/v1/projects/${project.id}/extensions/commands/test.owner.command.read/execute`, {});
    expect(persisted.outcome.value).toEqual({
      id: result.outcome.value.id,
      position: result.outcome.value.position,
      projectId: project.id,
    });
  } finally {
    await handle?.close();
    for (const [key, value] of Object.entries({
      PSTDIO_HOME: saved.home,
      PSTDIO_DEFAULT_EXTENSIONS: saved.defaults,
      PSTDIO_EXTENSION_PROCESS_OWNERS: saved.owners,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
