import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "serves core routes while an installed extension is still importing",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-extension-startup-"));
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let child: ChildProcess | undefined;
    const gate = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async () => {
        entered.resolve();
        await release.promise;
        return new Response("ready");
      },
    });
    try {
      const initial = await startPackagedServe(root);
      child = initial.child;
      const folder = join(root, "project");
      mkdirSync(folder);
      const created = await fetch(`${initial.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(initial.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Slow extension" }, folder)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      await stopProcess(child);

      const source = join(root, "extensions", "slow-extension");
      mkdirSync(source, { recursive: true });
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "slow-extension",
          version: "1.0.0",
          publisher: "test",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `await fetch(${JSON.stringify(gate.url.href)});\nexport default {};\n`,
      );

      const runtime = await startPackagedServe(root);
      child = runtime.child;
      await entered.promise;
      const headers = runtimeAuthorization(runtime.descriptor);
      const projects = await fetch(`${runtime.baseUrl}/v1/projects`, { headers });
      expect(projects.status).toBe(200);
      expect(await projects.json()).toContainEqual(expect.objectContaining({ id: project.id }));
      expect((await fetch(runtime.baseUrl)).status).toBe(200);

      release.resolve();
      let extensions: Array<{ installName: string }> = [];
      for (let attempt = 0; extensions.length === 0 && attempt < 100; attempt++) {
        const response = await fetch(`${runtime.baseUrl}/v1/projects/${project.id}/extensions`, { headers });
        expect(response.status).toBe(200);
        extensions = ((await response.json()) as { extensions: typeof extensions }).extensions;
        if (extensions.length === 0) await Bun.sleep(10);
      }
      expect(extensions).toContainEqual(expect.objectContaining({ installName: "slow-extension" }));
    } finally {
      release.resolve();
      if (child) await stopProcess(child);
      await gate.stop(true);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
