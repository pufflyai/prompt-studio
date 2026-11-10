import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { removeTestDirectory } from "../scripts/remove-test-directory";
import { enablePackagedProjectExtension } from "./packaged-project-extensions";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test("loads a shared extension across projects and reloads edited transitive imports", async () => {
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
      'import { marker } from "./shared"; export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: "Shared entry", run: async () => marker }] };',
    );
    writeFileSync(join(extensionPath, "shared.ts"), 'export const marker = "loaded";');

    const projects = await Promise.all(
      Array.from({ length: 4 }, async (_, index) => {
        const response = await fetch(`${host.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: `Concurrent project ${index}` })),
        });
        expect(response.status).toBe(201);
        const project = (await response.json()) as { id: string; extension_warnings?: unknown[] };
        await enablePackagedProjectExtension(host, project.id, "shared-entry");
        return project;
      }),
    );
    const instances: Array<{ projectId: string; instanceId: string }> = [];
    for (const project of projects) {
      expect(project.extension_warnings ?? []).toEqual([]);
      const response = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions`, {
        headers: runtimeAuthorization(host.descriptor),
      });
      expect(response.status).toBe(200);
      const catalog = (await response.json()) as {
        extensions: Array<{ id: string; installName: string; enabled: boolean }>;
      };
      expect(catalog.extensions).toContainEqual(
        expect.objectContaining({ installName: "shared-entry", enabled: true }),
      );
      instances.push({
        projectId: project.id,
        instanceId: catalog.extensions.find(({ installName }) => installName === "shared-entry")!.id,
      });
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

    writeFileSync(join(extensionPath, "shared.ts"), 'export { marker } from "./added";');
    writeFileSync(join(extensionPath, "added.ts"), 'export const marker = "updated";');
    for (const { projectId, instanceId } of instances) {
      const reloaded = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extensions/${instanceId}/reload`, {
        method: "POST",
        headers: runtimeAuthorization(host.descriptor),
      });
      expect(reloaded.status).toBe(200);
      expect(await reloaded.json()).toMatchObject({ status: "loaded", lastError: null });
      const command = await fetch(
        `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/test.shared-entry.command.check/execute`,
        {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ params: {} }),
        },
      );
      expect(command.status).toBe(200);
      expect(await command.json()).toMatchObject({ outcome: { status: "success", value: "updated" } });
    }
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});

test(
  "a compiled host validates two independent installs before either evaluation is released",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-install-pool-"));
    const repo = join(root, "project");
    const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    const release = Promise.withResolvers<void>();
    const gate = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        entered[Number(new URL(request.url).pathname.slice(1))]!.resolve();
        await release.promise;
        return new Response("ready");
      },
    });
    let child: ChildProcess | undefined;
    const installs: Promise<Response>[] = [];
    try {
      for (let index = 0; index < 2; index++) {
        const source = join(repo, `source-${index}`);
        mkdirSync(source, { recursive: true });
        writeFileSync(
          join(source, "package.json"),
          JSON.stringify({
            name: `concurrent-${index}`,
            publisher: "test",
            version: "1.0.0",
            main: "./extension.ts",
            engines: { pstdio: `^${EXTENSION_API_VERSION}` },
          }),
        );
        writeFileSync(
          join(source, "extension.ts"),
          `await fetch(${JSON.stringify(new URL(String(index), gate.url).href)}); export default {};`,
        );
      }
      const host = await startPackagedServe(root);
      child = host.child;
      const headers = { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" };
      const created = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Concurrent installs" }, repo)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const path = `${host.baseUrl}/v1/projects/${project.id}/extensions`;
      const initial = await fetch(path, { headers });
      expect(initial.status).toBe(200);
      for (let index = 0; index < 2; index++)
        installs.push(
          fetch(`${path}/install`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              source: { kind: "project-folder", path: `source-${index}` },
              installName: `concurrent-${index}`,
              skipInstall: true,
            }),
          }),
        );
      // Both native worker evaluations must enter while neither can complete.
      // The existing whole-test allowance owns failure; this is not a speed budget.
      await Promise.all(entered.map((entry) => entry.promise));
      const ready = await fetch(`${host.baseUrl}/runtime/ready`, { headers });
      expect(ready.status).toBe(200);
      release.resolve();
      for (const response of await Promise.all(installs)) {
        expect(response.status).toBe(201);
        await response.json();
      }
      const inventory = await fetch(path, { headers });
      expect(inventory.status).toBe(200);
      const result = (await inventory.json()) as { extensions: { installName: string; enabled: boolean }[] };
      for (let index = 0; index < 2; index++)
        expect(result.extensions).toContainEqual(
          expect.objectContaining({ installName: `concurrent-${index}`, enabled: true }),
        );
    } finally {
      release.resolve();
      await Promise.allSettled(installs);
      if (child) await stopProcess(child);
      await gate.stop(true);
      await removeTestDirectory(root);
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
