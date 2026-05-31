import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionSettingsDBService } from "./extension-settings";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionSettingsDBService>;
let installedExtensionId: string;
let instanceAId: string;
let instanceBId: string;

const nowTimestamp = () => new Date().toISOString();

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  service = createExtensionSettingsDBService(result.db);
  const sources = createInstalledExtensionSourcesDBService(result.db);
  const instances = createExtensionInstancesDBService(result.db);
  const timestamp = nowTimestamp();
  const projectAId = crypto.randomUUID();
  const projectBId = crypto.randomUUID();

  await result.db.insert(projects).values([
    { id: projectAId, name: "A", shorthand: "A", created_at: timestamp, updated_at: timestamp },
    { id: projectBId, name: "B", shorthand: "B", created_at: timestamp, updated_at: timestamp },
  ]);

  const installed = await sources.register({
    install_name: "extension-lab",
    extension_id: "pstdio.extension-lab",
    display_name: "Extension Lab",
    source_kind: "local_path",
    source_path: "/extensions/extension-lab",
  });
  installedExtensionId = installed.id;

  const instanceA = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectAId,
  });
  const instanceB = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectBId,
  });
  instanceAId = instanceA.id;
  instanceBId = instanceB.id;
});

afterEach(async () => {
  await close?.();
});

describe("extension settings persistence", () => {
  test("stores global values by installed source and project values by instance", async () => {
    await service.setValue({
      owner_type: "installed_extension",
      owner_id: installedExtensionId,
      extension_id: "pstdio.extension-lab",
      key: "model.default",
      value_json: "claude-sonnet-4",
    });
    await service.setValue({
      owner_type: "extension_instance",
      owner_id: instanceAId,
      extension_id: "pstdio.extension-lab",
      key: "counter.step",
      value_json: 2,
    });
    await service.setValue({
      owner_type: "extension_instance",
      owner_id: instanceBId,
      extension_id: "pstdio.extension-lab",
      key: "counter.step",
      value_json: 5,
    });

    await expect(
      service.getValue({
        owner_type: "installed_extension",
        owner_id: installedExtensionId,
        extension_id: "pstdio.extension-lab",
        key: "model.default",
      }),
    ).resolves.toMatchObject({ value_json: "claude-sonnet-4" });
    await expect(
      service.getValue({
        owner_type: "extension_instance",
        owner_id: instanceAId,
        extension_id: "pstdio.extension-lab",
        key: "counter.step",
      }),
    ).resolves.toMatchObject({ value_json: 2 });
    await expect(
      service.getValue({
        owner_type: "extension_instance",
        owner_id: instanceBId,
        extension_id: "pstdio.extension-lab",
        key: "counter.step",
      }),
    ).resolves.toMatchObject({ value_json: 5 });
  });

  test("handles concurrent writes to the same setting key", async () => {
    const key = {
      owner_type: "installed_extension" as const,
      owner_id: installedExtensionId,
      extension_id: "pstdio.extension-lab",
      key: "model.default",
    };

    await expect(
      Promise.all([
        service.setValue({ ...key, value_json: "claude-sonnet-4" }),
        service.setValue({ ...key, value_json: "claude-opus-4" }),
      ]),
    ).resolves.toHaveLength(2);

    const stored = await service.getValue(key);
    expect(stored?.value_json === "claude-sonnet-4" || stored?.value_json === "claude-opus-4").toBe(true);
  });
});
