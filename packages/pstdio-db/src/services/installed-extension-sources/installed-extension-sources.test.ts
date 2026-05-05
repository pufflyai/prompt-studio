import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createInstalledExtensionSourcesDBService } from "./installed-extension-sources";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createInstalledExtensionSourcesDBService>;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  svc = createInstalledExtensionSourcesDBService(result.db);
});

afterEach(async () => {
  await close?.();
});

describe("installedExtensionSourcesService", () => {
  test("registers and retrieves a source by install name", async () => {
    const registered = await svc.register({
      install_name: "pstdio.core-templates",
      extension_id: "pstdio.core-templates",
      display_name: "Core Templates",
      version: "0.1.0",
      source_kind: "builtin",
      source_path: "/builtin/pstdio.core-templates",
    });

    expect(registered.install_name).toBe("pstdio.core-templates");

    const fetched = await svc.getByInstallName("pstdio.core-templates");
    expect(fetched?.id).toBe(registered.id);
    expect(fetched?.status).toBe("pending");
  });

  test("updates load state and records reload events", async () => {
    const registered = await svc.register({
      install_name: "pstdio.core-skills",
      extension_id: "pstdio.core-skills",
      display_name: "Core Skills",
      source_kind: "builtin",
      source_path: "/builtin/pstdio.core-skills",
    });

    const updated = await svc.updateLoadState(registered.id, {
      status: "loaded",
      source_hash: "hash-1",
      loaded_revision: "rev-1",
      last_loaded_at: new Date().toISOString(),
    });

    expect(updated?.status).toBe("loaded");
    expect(updated?.source_hash).toBe("hash-1");

    await svc.recordReload({
      installed_extension_id: registered.id,
      previous_source_hash: null,
      next_source_hash: "hash-1",
      previous_revision: null,
      next_revision: "rev-1",
      status: "success",
    });

    const events = await svc.listReloadEvents(registered.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("success");
  });
});
