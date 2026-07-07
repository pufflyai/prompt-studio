import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createInstalledExtensionSourcesDBService } from "./installed-extension-sources";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let pglite: Awaited<ReturnType<typeof createDb>>["pglite"];

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  pglite = result.pglite;
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
      source_kind: "local_path",
      source_path: "/builtin/pstdio.core-templates",
    });

    expect(registered.install_name).toBe("pstdio.core-templates");

    const fetched = await svc.getByInstallName("pstdio.core-templates");
    expect(fetched?.id).toBe(registered.id);
    expect(fetched?.status).toBe("pending");
  });

  test("allows duplicate install names when source paths differ", async () => {
    const first = await svc.register({
      install_name: "worktree-bootstrap",
      extension_id: "pstdio.worktree-bootstrap",
      display_name: "Worktree Bootstrap",
      source_kind: "local_path",
      source_path: "/repo-a/.pstdio/extensions/worktree-bootstrap",
    });

    const second = await svc.register({
      install_name: "worktree-bootstrap",
      extension_id: "pstdio.worktree-bootstrap",
      display_name: "Worktree Bootstrap",
      source_kind: "local_path",
      source_path: "/repo-b/.pstdio/extensions/worktree-bootstrap",
    });

    expect(second.id).not.toBe(first.id);
    await expect(
      svc.register({
        install_name: "worktree-bootstrap-copy",
        extension_id: "pstdio.worktree-bootstrap",
        display_name: "Worktree Bootstrap",
        source_kind: "local_path",
        source_path: first.source_path,
      }),
    ).rejects.toThrow();
  });

  test("retrieves sources by source path and prefix", async () => {
    const repoRoot = "/repo/.pstdio/extensions";
    const first = await svc.register({
      install_name: "planner",
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "local_path",
      source_path: `${repoRoot}/planner`,
    });
    await svc.register({
      install_name: "other",
      extension_id: "pstdio.other",
      display_name: "Other",
      source_kind: "local_path",
      source_path: "/other-root/other",
    });

    const byPath = await svc.getBySourcePath(first.source_path);
    const byPrefix = await svc.listBySourcePathPrefix(repoRoot);

    expect(byPath?.id).toBe(first.id);
    expect(byPrefix.map((source) => source.id)).toEqual([first.id]);
  });

  test("filters source path prefixes in the database query", async () => {
    const queries: string[] = [];
    const originalQuery = pglite.query.bind(pglite);
    pglite.query = ((query, params, options) => {
      queries.push(query);
      return originalQuery(query, params, options);
    }) as typeof pglite.query;

    const repoRoot = "/repo/.pstdio/extensions";

    await svc.register({
      install_name: "planner",
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "local_path",
      source_path: `${repoRoot}/planner`,
    });
    await svc.register({
      install_name: "other",
      extension_id: "pstdio.other",
      display_name: "Other",
      source_kind: "local_path",
      source_path: "/other-root/other",
    });

    queries.length = 0;

    const byPrefix = await svc.listBySourcePathPrefix(repoRoot);
    const selectQuery = queries.find(
      (query) => query.toLowerCase().startsWith("select") && query.includes('"installed_extension_sources"'),
    );

    expect(byPrefix.map((source) => source.install_name)).toEqual(["planner"]);
    expect(selectQuery?.toLowerCase()).toContain(" where ");
    expect(selectQuery).toContain("source_path");
  });

  test("updates load state and records reload events", async () => {
    const registered = await svc.register({
      install_name: "pstdio.core-skills",
      extension_id: "pstdio.core-skills",
      display_name: "Core Skills",
      source_kind: "local_path",
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

  test("prunes reload events beyond the retention cap per installed extension", async () => {
    const first = await svc.register({
      install_name: "first",
      extension_id: "pstdio.first",
      display_name: "First",
      source_kind: "local_path",
      source_path: "/extensions/first",
    });
    const second = await svc.register({
      install_name: "second",
      extension_id: "pstdio.second",
      display_name: "Second",
      source_kind: "local_path",
      source_path: "/extensions/second",
    });

    for (let index = 0; index < 105; index++) {
      await svc.recordReload({
        installed_extension_id: first.id,
        next_source_hash: `first-${index}`,
        status: "error",
      });
    }
    await svc.recordReload({ installed_extension_id: second.id, next_source_hash: "second", status: "success" });

    expect(await svc.listReloadEvents(first.id, 200)).toHaveLength(100);
    expect(await svc.listReloadEvents(second.id, 200)).toHaveLength(1);
  });

  test("keeps the newest reload events when created_at timestamps tie", async () => {
    const source = await svc.register({
      install_name: "tied",
      extension_id: "pstdio.tied",
      display_name: "Tied",
      source_kind: "local_path",
      source_path: "/extensions/tied",
    });
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(value?: string | number | Date) {
        super(value ?? "2026-01-01T00:00:00.000Z");
      }

      static now() {
        return new RealDate("2026-01-01T00:00:00.000Z").getTime();
      }
    }
    globalThis.Date = FixedDate as DateConstructor;

    try {
      for (let index = 0; index < 105; index++) {
        await svc.recordReload({
          installed_extension_id: source.id,
          next_source_hash: `hash-${index}`,
          status: "error",
        });
      }
    } finally {
      globalThis.Date = RealDate;
    }

    const events = await svc.listReloadEvents(source.id, 200);

    expect(events.map((event) => event.next_source_hash)).toEqual(
      Array.from({ length: 100 }, (_value, index) => `hash-${index + 5}`),
    );
  });

  test("updates source registration metadata", async () => {
    const registered = await svc.register({
      install_name: "planner",
      extension_id: "pstdio.planner",
      display_name: "Planner",
      source_kind: "local_path",
      source_path: "/one",
    });

    const updated = await svc.updateRegistration(registered.id, {
      display_name: "Planner 2",
      manifest_json: { version: "2.0.0" },
      source_hash: "hash-2",
      source_path: "/two",
      status: "loaded",
      version: "2.0.0",
    });

    expect(updated?.display_name).toBe("Planner 2");
    expect(updated?.source_path).toBe("/two");
    expect(updated?.source_hash).toBe("hash-2");
    expect(updated?.manifest_json).toEqual({ version: "2.0.0" });
  });
});
