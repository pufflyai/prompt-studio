import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createInstances } from "./instances";
import { createSelectionCommands, instanceRowId } from "./selection-commands";

test.each([
  false,
  true,
])("bulk deletion preserves successful dismissals after a storage failure (%s)", async (failSave) => {
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const instance = randomUUID();
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      return Response.json({ id: new URL(request.url).pathname.split("/").at(-1), state: "succeeded" });
    },
  });
  const root = await mkdtemp(join(tmpdir(), "cloud-machine-deletion-"));
  try {
    const directory = join(root, instance);
    await mkdir(directory);
    await writeFile(join(directory, "instance.json"), JSON.stringify({ id: instance, url: server.url.toString() }));
    await writeFile(
      join(directory, "owner.json"),
      JSON.stringify({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    );
    const storage = createMemoryStorage();
    const ctx = makeCommandContext({
      storage,
      projectId: "test",
      params: {},
      overrides: { extensionId: "pocketcoder.pocketcoder" },
    });
    await storage.set(`dismissed-machines:${instance}`, ["previously-deleted"]);
    const save = storage.set.bind(storage);
    storage.set = async (key, value) => {
      if (failSave && Array.isArray(value) && value.includes(ids[0])) throw new Error("Storage save failed");
      await save(key, value);
    };
    const instances = createInstances(root);
    const machineReads = Promise.withResolvers<void>();
    let reads = 0;
    const commands = createSelectionCommands(() => ({
      ...instances,
      async request<T>(...args: Parameters<typeof instances.request>) {
        const result = await instances.request<T>(...args);
        if (++reads === ids.length) machineReads.resolve();
        await machineReads.promise;
        return result;
      },
    }));
    const deletion = commands.deleteSelectedMachines.run(ctx, { rowIds: ids.map((id) => instanceRowId(instance, id)) });
    if (failSave) await expect(deletion).rejects.toThrow("Storage save failed");
    else await deletion;
    expect((await storage.get<string[]>(`dismissed-machines:${instance}`))?.sort()).toEqual(
      [...(failSave ? ids.slice(1) : ids), "previously-deleted"].sort(),
    );
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
