import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { fileTurnFixture } from "./file-turns.test-fixture";
import { createInstances } from "./instances";
import { createMachineCommands } from "./machine-commands";
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

test("canceling Delete stops its changes read and preserves the machine row", async () => {
  const controller = new AbortController();
  const f = await fileTurnFixture((request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/changes")) {
      return Response.json({ workspace: { id: f.ref.machineId, state: "canceled", change_cursor: 2 } });
    }
    return Response.json({
      id: f.ref.machineId,
      state: path.endsWith("/cancel") ? "terminating" : "ready",
      change_cursor: 1,
    });
  });
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { signal: controller.signal } });
  try {
    let reachedTerminalChanges = false;
    const instances = f.ref.instances;
    const command = createMachineCommands(() => ({
      ...instances,
      async request<T>(...args: Parameters<typeof instances.request>) {
        const result = await instances.request<T>(...args);
        if (args[1].includes("/changes?")) {
          reachedTerminalChanges = true;
          controller.abort();
        }
        return result;
      },
    })).deleteMachine;
    await expect(command.run(ctx, { instance: f.ref.instanceId, machineId: f.ref.machineId })).rejects.toThrow();
    expect(reachedTerminalChanges).toBe(true);
    expect(await storage.get(`dismissed-machines:${f.ref.instanceId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});

test("canceling Delete stops waiting for the machine and keeps its row", async () => {
  const waiting = Promise.withResolvers<void>();
  const f = await fileTurnFixture((request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/cancel")) return Response.json({ id: f.ref.machineId, state: "terminating", change_cursor: 1 });
    if (path.endsWith("/changes")) {
      waiting.resolve();
      return new Promise<Response>(() => {});
    }
    return Response.json({ id: f.ref.machineId, state: "running", change_cursor: 0 });
  });
  const cancel = new AbortController();
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, projectId: "test", params: {}, overrides: { signal: cancel.signal } });
  try {
    const { deleteMachine } = createMachineCommands(() => f.ref.instances);
    const deletion = deleteMachine.run(ctx, { instance: f.ref.instanceId, machineId: f.ref.machineId });
    await waiting.promise;
    cancel.abort();
    await expect(deletion).rejects.toThrow();
    expect(await storage.get(`dismissed-machines:${f.ref.instanceId}`)).toBeUndefined();
  } finally {
    await f.close();
  }
});
