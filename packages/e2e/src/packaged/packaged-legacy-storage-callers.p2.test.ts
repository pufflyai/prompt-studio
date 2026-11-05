import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

interface State {
  layout: {
    camera: { x: number; y: number; zoom: number };
    positions: Record<string, { x: number; y: number }>;
    themes: Record<string, string>;
  };
  example: { filter: string; query: string; playing: boolean };
  scribble: {
    documents: { id: string; title: string }[];
    contentById: Record<string, string>;
  };
}

test(
  "unchanged Canvas and Lab callers migrate, save and recover through the packaged storage host",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-legacy-callers-"));
    const entries = [
      { name: "legacy-layout", path: "canvas/src/legacy-layout.fixture.ts" },
      { name: "legacy-state", path: "extension-lab/src/legacy-state.fixture.ts" },
    ];
    const extensions = [];
    for (const entry of entries) {
      const source = join(root, entry.name);
      mkdirSync(source);
      const built = await Bun.build({
        entrypoints: [join(import.meta.dir, "../../../../extensions", entry.path)],
        target: "bun",
      });
      if (!built.success) throw new AggregateError(built.logs, "Could not bundle unchanged storage callers");
      await Bun.write(join(source, "extension.js"), built.outputs[0]!);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: entry.name,
          publisher: "example",
          version: "1.0.0",
          type: "module",
          main: "extension.js",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      extensions.push({ source, installName: entry.name });
    }
    const env = { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(extensions) };
    let host = await startPackagedServe(root, env);
    const post = (path: string, body: unknown) =>
      fetch(`${host.baseUrl}/v1${path}`, {
        method: "POST",
        headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const command = async <T>(projectId: string, id: string, extension = "legacy-state") => {
      const response = await post(
        `/projects/${projectId}/extensions/commands/example.${extension}.command.${id}/execute`,
        { params: {} },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { outcome: { ok: boolean; value: T } };
      expect(body.outcome).toMatchObject({ ok: true });
      return body.outcome.value;
    };
    const read = async (projectId: string) => ({
      layout: await command<State["layout"]>(projectId, "read", "legacy-layout"),
      ...(await command<Omit<State, "layout">>(projectId, "read")),
    });
    try {
      const created = await post("/projects", folderProjectInput({ name: "Legacy callers" }, root));
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const seeded = await command<{ migrated: State["scribble"] }>(project.id, "write");
      expect(seeded.migrated.documents.find(({ id }) => id === "north-star")?.title).toBe("Migrated page");
      await command(project.id, "write", "legacy-layout");
      const saved = await read(project.id);
      expect(saved.layout).toMatchObject({
        camera: { x: 72, y: -30, zoom: 1.5 },
        positions: { first: { x: 120, y: 80 }, second: { x: 900, y: 100 } },
        themes: { first: "app", second: "dark" },
      });
      expect(saved.example).toMatchObject({ filter: "Favorites", query: "Saved search", playing: true });
      expect(saved.scribble.contentById).toMatchObject({
        "north-star": "Existing page content",
        "new-page": "New page content",
      });
      expect(saved.scribble.documents.find(({ id }) => id === "new-page")?.title).toBe("New page");
      await stopProcess(host.child);
      host = await startPackagedServe(root, env);
      expect(await read(project.id)).toEqual(saved);
      await command(project.id, "update");
      await command(project.id, "update", "legacy-layout");
      const later = await read(project.id);
      expect(later.layout).toMatchObject({
        camera: saved.layout.camera,
        positions: { first: { x: 240, y: 160 }, second: saved.layout.positions.second },
        themes: saved.layout.themes,
      });
      expect(later.example).toMatchObject({ filter: "Favorites", query: "Saved search", playing: false });
      expect(later.scribble.contentById).toMatchObject({
        "north-star": "Existing page content",
        "new-page": "Later content",
      });
      expect(later.scribble.documents.find(({ id }) => id === "new-page")?.title).toBe("Later page");
      await stopProcess(host.child);
      host = await startPackagedServe(root, env);
      expect(await read(project.id)).toEqual(later);
    } finally {
      await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
