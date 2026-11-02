import { expect, test } from "bun:test";
import { DEFAULT_OUT } from "@pstdio/canvas";
import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../extension";
import { commands } from "./commands";
import { canvasResources } from "./resources";
import { testManifest } from "./test-build";

const foundations = "src/foundations.canvas.tsx";
const context = (projectFiles: Partial<ArtifactMount> | undefined) => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const base = ctx.artifacts.mount("build");
  return Object.assign(ctx, {
    projectFiles,
    artifacts: {
      mount: () => ({
        ...base,
        exists: (path: string) => projectFiles?.exists?.(`${DEFAULT_OUT}/${path}`) ?? Promise.resolve(false),
        readText: (path: string) =>
          projectFiles?.readText?.(`${DEFAULT_OUT}/${path}`) ?? Promise.reject(new Error("No ready workspace")),
      }),
    },
  });
};

test("a project without a readable folder shows an empty, explained state instead of failing", async () => {
  const tree = extension.views.find((view) => view.body.kind === "tree")!;
  if (tree.body.kind !== "tree") throw new Error("Canvas selection must use the navigation tree");
  const unreadable = { exists: async () => Promise.reject(new Error("No ready workspace")) };
  for (const ctx of [context(undefined), context(unreadable)]) {
    expect(await commands.list.run(ctx, {})).toEqual({ status: "unavailable", canvases: [] });
    expect((await commands["canvas.read"].run(ctx, {})).status).toBe("unavailable");
    expect((await canvasResources.query(ctx, { query: "", limit: 10 } as never)).items).toEqual([]);
    expect((await tree.body.body(ctx))[0]!.nodes).toEqual([]);
  }
});

// A project folder that counts manifest reads and can swap in a newer build mid-request.
// Each folder reports its own timestamps, so a manifest cached by one test never matches another.
const projectFolder = (manifests: ReturnType<typeof testManifest>[], modules: Record<string, string>) => {
  const folder = crypto.randomUUID();
  let reads = 0;
  return {
    reads: () => reads,
    files: {
      exists: async (path: string) => path === `${DEFAULT_OUT}/manifest.json`,
      list: async () => [
        { path: `${DEFAULT_OUT}/manifest.json`, updatedAt: `${folder}-build-${Math.min(reads, manifests.length - 1)}` },
      ],
      readText: async (path: string) => {
        if (path === `${DEFAULT_OUT}/manifest.json`)
          return JSON.stringify(manifests[Math.min(reads++, manifests.length - 1)]);
        const module = modules[path.slice(DEFAULT_OUT.length + 1)];
        if (module === undefined) throw new Error(`Missing ${path}`);
        return module;
      },
    },
  };
};

test("frames observe changed manifest contents even when filesystem timestamps match", async () => {
  const before = testManifest();
  before.frames.modules["foundations.js"]!.file = "modules/before.txt";
  const folder = projectFolder([before, testManifest()], {
    "modules/runtime.txt": "runtime",
    "modules/before.txt": "before",
    "modules/foundations.txt": "after",
  });
  const ctx = context(folder.files);
  expect((await commands["preview.assets"].run(ctx, { source: foundations, cached: [] })).files["foundations.js"]).toBe(
    "before",
  );
  expect((await commands["preview.assets"].run(ctx, { source: foundations, cached: [] })).files["foundations.js"]).toBe(
    "after",
  );
});

test("a frame whose modules a new build replaced loads from the newest build", async () => {
  const old = testManifest();
  old.frames.modules["foundations.js"]!.file = "modules/removed.txt";
  const folder = projectFolder([old, testManifest()], {
    "modules/runtime.txt": "runtime",
    "modules/foundations.txt": "new",
  });
  const assets = await commands["preview.assets"].run(context(folder.files), { source: foundations, cached: [] });
  expect(assets.files["foundations.js"]).toBe("new");
});

test.each([
  "../../../../private.txt",
  "..\\..\\..\\..\\private.txt",
])("preview assets reject a manifest path that leaves the build folder: %s", async (path) => {
  const manifest = testManifest();
  manifest.frames.modules["foundations.js"]!.file = path;
  const folder = projectFolder([manifest], { "modules/runtime.txt": "runtime", [path]: "private project data" });
  await expect(
    commands["preview.assets"].run(context(folder.files), { source: foundations, cached: [] }),
  ).rejects.toThrow("Canvas build path escapes the build folder");
});
