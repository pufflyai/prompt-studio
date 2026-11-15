import { beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { buildBinary } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

beforeAll(() => buildBinary(), 180_000);

test(
  "a packaged host isolates incompatible extensions and recovers after a compatible extension update",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-extension-compatibility-"));
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    const output: string[] = [];
    const writeSource = (name: string, range: string) => {
      const path = join(root, "extensions", name);
      mkdirSync(path, { recursive: true });
      writeFileSync(
        join(path, "package.json"),
        JSON.stringify({
          name,
          publisher: "test",
          version: "1.0.0",
          main: "./extension.ts",
          engines: { pstdio: range },
        }),
      );
      writeFileSync(
        join(path, "extension.ts"),
        `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(join(root, `${name}-executed`))}, "executed");
export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title: "Hello", run: async () => "hello" }] };`,
      );
    };
    try {
      writeSource("healthy", `^${EXTENSION_API_VERSION}`);
      writeSource("incompatible", "^0.3.0");
      host = await startPackagedServe(root, {}, undefined, undefined, (chunk) => output.push(chunk.toString()));
      const headers = { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" };
      const folder = join(root, "project");
      mkdirSync(folder);
      const created = await fetch(`${host.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Compatibility" }, folder)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const url = `${host.baseUrl}/v1/projects/${project.id}/extensions`;
      const inventoryResponse = await fetch(url, { headers });
      expect(inventoryResponse.status).toBe(200);
      const inventory = (await inventoryResponse.json()) as {
        extensions: Array<{ id: string; name: string; status: string; lastError: { code: string } | null }>;
      };
      const incompatible = inventory.extensions.find((extension) => extension.name === "incompatible");
      expect(incompatible).toMatchObject({
        status: "error",
        lastError: { code: "extension_manifest_unsupported_api_version" },
      });
      for (const extension of inventory.extensions) {
        const enabled = await fetch(`${url}/${extension.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ enabled: true }),
        });
        expect(enabled.status).toBe(200);
      }
      const metadataResponse = await fetch(`${url}/ui`, { headers });
      expect(metadataResponse.status).toBe(200);
      const metadata = await metadataResponse.json();
      expect(metadata.commands.map((command: { id: string }) => command.id)).toContain("test.healthy.command.hello");
      expect(metadata.commands.map((command: { id: string }) => command.id)).not.toContain(
        "test.incompatible.command.hello",
      );
      expect(metadata.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "extension_manifest_unsupported_api_version",
          extensionId: "test.incompatible",
        }),
      );
      expect(existsSync(join(root, "healthy-executed"))).toBe(true);
      expect(existsSync(join(root, "incompatible-executed"))).toBe(false);
      expect(output.join("")).not.toContain('"event":"extensions.webview_build.error"');

      writeSource("incompatible", `^${EXTENSION_API_VERSION}`);
      const reload = await fetch(`${url}/${incompatible!.id}/reload`, { method: "POST", headers });
      expect(reload.status).toBe(200);
      const recovered = await (await fetch(`${url}/ui`, { headers })).json();
      expect(recovered.commands.map((command: { id: string }) => command.id)).toContain(
        "test.incompatible.command.hello",
      );
      expect(recovered.diagnostics).not.toContainEqual(
        expect.objectContaining({ code: "extension_manifest_unsupported_api_version" }),
      );
      expect(existsSync(join(root, "incompatible-executed"))).toBe(true);
    } finally {
      if (host) await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
