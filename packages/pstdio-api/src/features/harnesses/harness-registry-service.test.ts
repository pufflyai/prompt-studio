import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { installExtensionSource } from "../extensions/install-extension-source";

const REPO_ROOT = resolve(import.meta.dir, "../../../../..");

describe("harness registry", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-harness-registry-"));
  const previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  const previousPstdioHome = process.env.PSTDIO_HOME;

  const restoreEnv = () => {
    if (previousDefaultExtensions === undefined) {
      delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    } else {
      process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
    }
    if (previousPstdioHome === undefined) {
      delete process.env.PSTDIO_HOME;
    } else {
      process.env.PSTDIO_HOME = previousPstdioHome;
    }
  };

  afterEach(() => {
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("installs default harness extensions before serving agent info", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-defaults");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source: resolve(REPO_ROOT, "extensions/extension-lab"), installName: "extension-lab", skipInstall: true },
    ]);

    const { app, close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-defaults"),
    });

    try {
      const res = await app.request("/v1/agents/info");
      const agents = (await res.json()) as Array<{ id: string; name: string; availability: { type: string } }>;

      expect(agents).toEqual([
        { id: "pstdio.extension-lab.harness.fake", name: "Fake Agent", availability: { type: "INSTALLED" } },
      ]);
    } finally {
      await close();
    }
  }, 40_000);

  test("resolves harnesses from extensions the user installed into PSTDIO_HOME, before any project exists", async () => {
    // The user decides what lives in PSTDIO_HOME/extensions (`pst extensions add`);
    // the host only loads what is there.
    process.env.PSTDIO_HOME = join(tempRoot, "home");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/extension-lab"), skipInstall: true });

    const { app, close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
    });

    try {
      const res = await app.request("/v1/agents/info");
      const agents = (await res.json()) as Array<{ id: string; name: string; availability: { type: string } }>;

      expect(agents).toEqual([
        { id: "pstdio.extension-lab.harness.fake", name: "Fake Agent", availability: { type: "INSTALLED" } },
      ]);
    } finally {
      await close();
    }
  }, 40_000);

  test("project-create selection disables unselected harness extensions and scopes listings", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-selection");
    process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/extension-lab"), skipInstall: true });
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/harness-claude-code"), skipInstall: true });

    const { app, close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-selection"),
    });

    try {
      // Leaving claude-code unselected at create disables its extension for this project.
      const project = await (
        await app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "fake-only", agents: ["pstdio.extension-lab.harness.fake"] }),
        })
      ).json();

      const scoped = (await (await app.request(`/v1/agents/info?project=${project.id}`)).json()) as Array<{
        id: string;
      }>;
      expect(scoped.map((agent) => agent.id)).toEqual(["pstdio.extension-lab.harness.fake"]);

      // Globally both harnesses stay installed and listed.
      const globalInfo = (await (await app.request("/v1/agents/info")).json()) as Array<{ id: string }>;
      expect(globalInfo.map((agent) => agent.id).sort()).toEqual([
        "pstdio.extension-lab.harness.fake",
        "pstdio.harness-claude-code.harness.claude-code",
      ]);

      // Sessions in that project cannot use the disabled harness.
      const sessionRes = await app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "blocked",
          prompt: "blocked",
          agent: "pstdio.harness-claude-code.harness.claude-code",
        }),
      });
      expect(sessionRes.status).toBe(400);
    } finally {
      await close();
    }
  }, 60_000);
});
