import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../../app";
import { installExtensionSource } from "../extensions/install-extension-source";

const REPO_ROOT = resolve(import.meta.dir, "../../../../..");

describe("harness registry", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-harness-registry-"));

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("resolves harnesses from extensions the user installed into PSTDIO_HOME, before any project exists", async () => {
    // The user decides what lives in PSTDIO_HOME/extensions (`pst extensions add`);
    // the host only loads what is there.
    process.env.PSTDIO_HOME = join(tempRoot, "home");
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/harness-lab") });

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    try {
      const res = await app.request("/v1/agents/info");
      const agents = (await res.json()) as Array<{ id: string; name: string; availability: { type: string } }>;

      expect(agents).toEqual([
        { id: "pstdio.harness-lab.fake", name: "Fake Agent", availability: { type: "INSTALLED" } },
      ]);
    } finally {
      await close();
    }
  }, 40_000);

  test("project-create selection disables unselected harness extensions and scopes listings", async () => {
    process.env.PSTDIO_HOME = join(tempRoot, "home-selection");
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/harness-lab") });
    await installExtensionSource({ source: resolve(REPO_ROOT, "extensions/harness-claude-code") });

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage-selection"),
      filesRoot: "",
    });

    try {
      // Leaving claude-code unselected at create disables its extension for this project.
      const project = await (
        await app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "fake-only", agents: ["pstdio.harness-lab.fake"] }),
        })
      ).json();

      const scoped = (await (await app.request(`/v1/agents/info?project=${project.id}`)).json()) as Array<{
        id: string;
      }>;
      expect(scoped.map((agent) => agent.id)).toEqual(["pstdio.harness-lab.fake"]);

      // Globally both harnesses stay installed and listed.
      const globalInfo = (await (await app.request("/v1/agents/info")).json()) as Array<{ id: string }>;
      expect(globalInfo.map((agent) => agent.id).sort()).toEqual([
        "pstdio.harness-claude-code.claude-code",
        "pstdio.harness-lab.fake",
      ]);

      // Sessions in that project cannot use the disabled harness.
      const sessionRes = await app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "blocked",
          prompt: "blocked",
          agent: "pstdio.harness-claude-code.claude-code",
        }),
      });
      expect(sessionRes.status).toBe(400);
    } finally {
      await close();
    }
  }, 60_000);
});
