import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("packaged app-wide extensions keep device settings across projects and restarts", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-extension-settings-"));
  let child: ChildProcess | undefined;
  try {
    const source = join(root, "extensions", "device-settings");
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "device-settings",
        publisher: "test",
        version: "1.0.0",
        type: "module",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(join(source, "panel.ts"), "export default () => null;");
    writeFileSync(
      join(source, "extension.ts"),
      `export default {
        settings: { properties: { capacity: { type: "number", scope: "device", default: 2 } } },
        views: [{ id: "settings", ref: { kind: "view", id: "settings" }, title: "Device settings",
          body: { kind: "webview", entry: { kind: "package-asset", path: "./panel.ts", baseUrl: import.meta.url } } }],
        settingsPanels: [{ id: "settings", ref: { kind: "settings-panel", id: "settings" },
          view: { kind: "view", id: "settings" }, slot: { extensionId: "pstdio", kind: "settings-panel", id: "global.settings" } }],
        commands: [{ id: "capacity", ref: { kind: "command", id: "capacity" }, title: "Capacity", params: {},
          async run(ctx) { return ctx.settings.get("capacity"); } }],
      };`,
    );
    const catalog = join(root, "catalog.json");
    writeFileSync(
      catalog,
      JSON.stringify({
        version: 1,
        extensions: [
          {
            installName: "device-settings",
            displayName: "Device settings",
            description: "Settings",
            default: false,
            alwaysEnabled: true,
            origin: {
              kind: "git",
              url: "https://github.com/pufflyai/prompt-studio",
              path: "extensions/device-settings",
              ref: "main",
            },
          },
        ],
      }),
    );
    let started = await startPackagedServe(root, { PSTDIO_EXTENSION_CATALOG: catalog });
    child = started.child;
    const request = (path: string, method = "GET", body?: unknown) =>
      fetch(`${started.baseUrl}${path}`, {
        method,
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const projects: Array<{ id: string; instanceId: string }> = [];
    for (const name of ["First", "Second"]) {
      const projectPath = join(root, name);
      mkdirSync(projectPath);
      const created = await request("/v1/projects", "POST", folderProjectInput({ name }, projectPath));
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const metadata = (await (await request(`/v1/projects/${project.id}/extensions/ui`)).json()) as {
        extensions: Array<{ id: string; extensionInstanceId: string }>;
        settingsPanels: Array<{ slot: { id: string } }>;
      };
      const extension = metadata.extensions.find((item) => item.id === "test.device-settings");
      expect(extension).toBeDefined();
      expect(metadata.settingsPanels).toContainEqual(
        expect.objectContaining({ slot: expect.objectContaining({ id: "global.settings" }) }),
      );
      projects.push({ id: project.id, instanceId: extension!.extensionInstanceId });
    }
    const settingsPath = (project: { id: string; instanceId: string }) =>
      `/v1/projects/${project.id}/extensions/${project.instanceId}/settings/capacity`;
    expect((await request(settingsPath(projects[0]!), "PUT", { value: 5 })).status).toBe(200);
    expect(await (await request(settingsPath(projects[1]!))).json()).toMatchObject({ value: 5, scope: "device" });
    await stopProcess(child);
    child = undefined;
    started = await startPackagedServe(root, { PSTDIO_EXTENSION_CATALOG: catalog });
    child = started.child;
    const result = await request(
      `/v1/projects/${projects[1]!.id}/extensions/commands/test.device-settings.command.capacity/execute`,
      "POST",
      { source: "api", params: {} },
    );
    expect(await result.json()).toMatchObject({ outcome: { ok: true, value: 5 } });
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
