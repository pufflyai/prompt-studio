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
for (const resolution of ["conditional", "main"]) {
  test(
    `a compiled warm restart retains ${resolution} dependencies while changed source evaluation is blocked`,
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-prepared-revision-"));
      const source = join(root, "extensions", "warm-tool");
      mkdirSync(source, { recursive: true });
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "warm-tool",
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          dependencies: { "parent-dep": "1.0.0" },
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      const parent = join(source, "node_modules", "parent-dep");
      const ancestor = join(source, "node_modules", "conditional-dep");
      const nested = join(parent, "node_modules", "conditional-dep");
      for (const path of [parent, ancestor, nested]) mkdirSync(path, { recursive: true });
      writeFileSync(
        join(parent, "package.json"),
        JSON.stringify({
          name: "parent-dep",
          version: "1.0.0",
          main: "index.js",
          dependencies: { "conditional-dep": "2.0.0" },
        }),
      );
      writeFileSync(join(parent, "index.js"), 'export { value } from "conditional-dep";');
      writeFileSync(
        join(ancestor, "package.json"),
        JSON.stringify({ name: "conditional-dep", version: "1.0.0", main: "index.js" }),
      );
      writeFileSync(join(ancestor, "index.js"), 'export const value = "incorrect ancestor";');
      writeFileSync(
        join(nested, "package.json"),
        JSON.stringify({
          name: "conditional-dep",
          version: "2.0.0",
          ...(resolution === "main"
            ? { main: "./dist/esm/entry.js" }
            : {
                exports: {
                  ".": {
                    import: { default: "./dist/esm/entry.js" },
                    require: { default: "./dist/commonjs/entry.cjs" },
                  },
                },
              }),
        }),
      );
      mkdirSync(join(nested, "dist", "esm"), { recursive: true });
      mkdirSync(join(nested, "dist", "commonjs"), { recursive: true });
      writeFileSync(join(nested, "dist", "esm", "entry.js"), 'export const value = "accepted tool";');
      writeFileSync(join(nested, "dist", "commonjs", "entry.cjs"), 'exports.value = "accepted tool";');
      const definition = `import { value } from "parent-dep"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value }], views: [{ id: "page", ref: { kind: "view", id: "page" }, title: "Page", body: { kind: "webview", entry: { kind: "package-asset", path: "./main.ts", baseUrl: import.meta.url } } }] };`;
      writeFileSync(join(source, "extension.ts"), definition);
      writeFileSync(join(source, "main.ts"), 'document.body.textContent = "Accepted tool";');
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const gate = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: async () => {
          entered.resolve();
          await release.promise;
          return new Response("continue");
        },
      });
      let child: ChildProcess | undefined;
      try {
        const first = await startPackagedServe(root);
        child = first.child;
        const folder = join(root, "project");
        mkdirSync(folder);
        const created = await fetch(`${first.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(first.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Warm tool" }, folder)),
        });
        expect(created.status).toBe(201);
        const project = (await created.json()) as { id: string };
        const enabled = await fetch(
          `${first.baseUrl}/v1/projects/${project.id}/extensions/installed/warm-tool/enable`,
          {
            method: "POST",
            headers: { ...runtimeAuthorization(first.descriptor), "content-type": "application/json" },
            body: JSON.stringify({
              displayName: "Warm tool",
              extensionId: "test.warm-tool",
              manifest: {},
              name: "warm-tool",
              sourcePath: source,
              sourceKind: "local_path",
              version: "1.0.0",
            }),
          },
        );
        expect(enabled.status).toBe(200);
        const uiPath = `/v1/projects/${project.id}/extensions/ui`;
        const initialUi = await fetch(`${first.baseUrl}${uiPath}`, { headers: runtimeAuthorization(first.descriptor) });
        expect(initialUi.status).toBe(200);
        expect(
          ((await initialUi.json()) as { commands: Array<{ id: string }> }).commands.some(
            (command) => command.id === "test.warm-tool.command.value",
          ),
        ).toBe(true);
        await stopProcess(child);
        child = undefined;
        writeFileSync(join(source, "extension.ts"), `await fetch(${JSON.stringify(gate.url.href)});\n${definition}`);
        const startedAt = performance.now();
        const warm = await startPackagedServe(root);
        child = warm.child;
        await entered.promise;
        const headers = runtimeAuthorization(warm.descriptor);
        const metadata = await fetch(`${warm.baseUrl}${uiPath}`, { headers });
        expect(metadata.status).toBe(200);
        const executed = await fetch(
          `${warm.baseUrl}/v1/projects/${project.id}/extensions/commands/test.warm-tool.command.value/execute`,
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ source: "api", params: {} }),
          },
        );
        expect(executed.status).toBe(200);
        expect(await executed.json()).toMatchObject({ outcome: { ok: true, value: "accepted tool" } });
        const requestMilliseconds: number[] = [];
        for (let index = 0; index < 5; index++) {
          const requestedAt = performance.now();
          const response = await fetch(`${warm.baseUrl}/v1/projects`, { headers });
          expect(response.status).toBe(200);
          await response.arrayBuffer();
          requestMilliseconds.push(performance.now() - requestedAt);
        }
        console.log(
          JSON.stringify({
            operation: "packaged_warm_accepted_tool",
            usableMilliseconds: Math.round(performance.now() - startedAt),
            cache: "populated",
            reconciliation: "blocked",
            network: "no extension downloads",
            requestMilliseconds,
          }),
        );
      } finally {
        release.resolve();
        if (child) await stopProcess(child);
        await gate.stop(true);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
}
