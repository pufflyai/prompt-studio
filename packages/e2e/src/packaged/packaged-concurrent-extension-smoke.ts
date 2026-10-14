import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerConcurrentExtensionSmokeTests = () => {
  test("sets up concurrent projects sharing an uncached extension", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-concurrent-extension-"));
    let child: ChildProcess | undefined;
    try {
      const host = await startPackagedServe(root);
      child = host.child;
      const extensionPath = join(root, "extensions", "shared-entry");
      mkdirSync(extensionPath, { recursive: true });
      writeFileSync(
        join(extensionPath, "package.json"),
        JSON.stringify({
          name: "shared-entry",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(extensionPath, "extension.ts"),
        'export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: "Shared entry", run: async () => "loaded" }] };',
      );

      const projects = await Promise.all(
        Array.from({ length: 4 }, async (_, index) => {
          const response = await fetch(`${host.baseUrl}/v1/projects`, {
            method: "POST",
            headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
            body: JSON.stringify(folderProjectInput({ name: `Concurrent project ${index}` })),
          });
          expect(response.status).toBe(201);
          return (await response.json()) as { id: string; extension_warnings?: unknown[] };
        }),
      );
      for (const project of projects) {
        expect(project.extension_warnings ?? []).toEqual([]);
        const response = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions`, {
          headers: runtimeAuthorization(host.descriptor),
        });
        expect(response.status).toBe(200);
        const catalog = (await response.json()) as { extensions: Array<{ installName: string; enabled: boolean }> };
        expect(catalog.extensions).toContainEqual(
          expect.objectContaining({ installName: "shared-entry", enabled: true }),
        );
        const command = await fetch(
          `${host.baseUrl}/v1/projects/${project.id}/extensions/commands/test.shared-entry.command.check/execute`,
          {
            method: "POST",
            headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
            body: JSON.stringify({ params: {} }),
          },
        );
        expect(command.status).toBe(200);
        expect(await command.json()).toMatchObject({ outcome: { status: "success", value: "loaded" } });
      }
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
