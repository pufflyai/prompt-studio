import { afterEach, beforeEach, expect, test } from "bun:test";
import { createExtensionStorageDBService } from "./extension-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

type StorageFixture = Awaited<ReturnType<typeof createExtensionStorageFixture>>;

let close: (() => Promise<void>) | undefined;
let db: StorageFixture["db"];
let svc: ReturnType<typeof createExtensionStorageDBService>;
let projectAId: string;
let projectBId: string;
let instanceAId: string;
let instanceBId: string;

beforeEach(async () => {
  ({ db, close, svc, projectAId, projectBId, instanceAId, instanceBId } = await createExtensionStorageFixture());
});

afterEach(async () => {
  await close?.();
});

test("migration checkpoints cannot read or overwrite the public custom-scope namespace", async () => {
  const scope = {
    project_id: projectAId,
    extension_instance_id: instanceAId,
    scope_type: "project",
    scope_id: projectAId,
  };
  const custom = { ...scope, scope_type: "migration:project" };
  await svc.setKv({ ...custom, key: "version", value_json: 1 });
  let runs = 0;
  await svc.migrate(scope, 1, async (previous) => {
    expect(previous).toBe(0);
    runs++;
  });
  await svc.migrate(scope, 2, async () => {
    runs++;
  });
  expect(runs).toBe(2);
  expect((await svc.getKv(custom, "version"))?.value_json).toBe(1);
});

test("data migrations serialize concurrent requests and survive service recreation", async () => {
  const scope = {
    project_id: projectAId,
    extension_instance_id: instanceAId,
    scope_type: "project",
    scope_id: projectAId,
  };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const previous: number[] = [];
  const first = svc.migrate(scope, 1, async (version) => {
    previous.push(version);
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const second = svc.migrate(scope, 1, async () => {
    throw new Error("Concurrent migration ran twice");
  });
  release.resolve();
  await Promise.all([first, second]);
  const restarted = createExtensionStorageDBService(db);
  await restarted.migrate(scope, 2, async (version) => {
    previous.push(version);
  });
  expect(previous).toEqual([0, 1]);
});

test("failed imports retain their previous data version and other storage scopes stay independent", async () => {
  const scope = {
    project_id: projectAId,
    extension_instance_id: instanceAId,
    scope_type: "project",
    scope_id: projectAId,
  };
  await expect(
    svc.migrate(scope, 1, async () => {
      throw new Error("Import interrupted");
    }),
  ).rejects.toThrow("Import interrupted");
  await svc.migrate(scope, 1, async (version) => {
    expect(version).toBe(0);
  });
  await svc.migrate({ ...scope, scope_type: "resource", scope_id: "note" }, 1, async (version) => {
    expect(version).toBe(0);
  });
  await svc.migrate(
    { extension_instance_id: instanceBId, scope_type: "project", scope_id: projectBId },
    1,
    async (version) => {
      expect(version).toBe(0);
    },
  );
  await expect(svc.migrate(scope, 0.5, async () => {})).rejects.toThrow("positive");
});
