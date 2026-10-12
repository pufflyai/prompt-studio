import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";

test("webview preference API round trips undeclared names and refuses read-only scopes", async () => {
  const root = await mkdtemp(join(tmpdir(), "webview-preferences-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const handle = await createTestApp({ storageRoot: join(root, "storage") });
  try {
    const projectResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Preferences" })),
    });
    const project = await projectResponse.json();
    const sourcePath = join(root, "extension");
    await mkdir(sourcePath);
    await Bun.write(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "preferences",
        displayName: "Preferences",
        publisher: "acme",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await Bun.write(join(sourcePath, "extension.ts"), "export default {};");
    const enabled = await handle.app.request(`/v1/projects/${project.id}/extensions/installed/preferences/enable`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Preferences",
        extensionId: "acme.preferences",
        manifest: { id: "acme.preferences", name: "preferences" },
        name: "preferences",
        sourceHash: null,
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: null,
      }),
    });
    expect(enabled.status).toBe(200);
    const { instanceId } = await enabled.json();
    const path = `/v1/projects/${project.id}/extensions/${instanceId}/preferences/lastRange`;
    const put = (query: string, value: unknown) =>
      handle.app.request(`${path}${query}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
    expect((await put("", "now-6h")).status).toBe(200);
    expect(await (await handle.app.request(path)).json()).toEqual({ name: "lastRange", value: "now-6h" });
    const globalPath = "/v1/extensions/installed/preferences/preferences/lastRange";
    expect(await (await handle.app.request(`${globalPath}?scope=user&scopeId=other`)).json()).toEqual({
      name: "lastRange",
      value: "now-6h",
    });
    expect((await put("?scope=project", "now-24h")).status).toBe(200);
    expect(await (await handle.app.request(`${path}?scope=project`)).json()).toEqual({
      name: "lastRange",
      value: "now-24h",
    });
    expect(await (await handle.app.request(path)).json()).toEqual({ name: "lastRange", value: "now-6h" });
    expect(await (await put("?scope=default", "bad")).json()).toMatchObject({ code: "preference_scope_read_only" });
    expect(await (await put("", "a".repeat(16385))).json()).toMatchObject({ code: "preference_too_large" });
    expect(
      (await handle.app.request(`/v1/projects/${project.id}/extensions/missing/preferences/lastRange`)).status,
    ).toBe(404);
    expect(handle.deps.eventBus.getSince(0).some((event) => event.table === "webview_preferences")).toBe(true);
    const choices = { filters: { harnesses: ["codex"], enabled: true }, cleared: null };
    expect((await put("?scope=project", choices)).status).toBe(200);
    expect(await (await handle.app.request(`${path}?scope=project`)).json()).toEqual({
      name: "lastRange",
      value: choices,
    });
  } finally {
    await handle.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
    await rm(root, { recursive: true, force: true });
  }
});
