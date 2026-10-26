import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "packaged assets resume after runtime restart and retain verified versions",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-assets-"));
    const source = join(root, "extensions", "asset-probe");
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "asset-probe",
        publisher: "e2e",
        version: "1.0.0",
        main: "extension.ts",
        type: "module",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(
      join(source, "extension.ts"),
      `export default { commands: [{
      id: "stage", ref: { kind: "command", id: "stage" }, title: "Stage bytes",
      run: async (ctx) => {
        const asset = await ctx.storage.assets.stage({ operationId: "command", source: new Blob(["extension bytes"]) });
        await ctx.storage.assets.verifyComplete([asset]);
        return { asset, text: await new Response(await ctx.storage.assets.read(asset)).text() };
      },
    }] };`,
    );
    const env = {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "asset-probe", skipInstall: true }]),
    };
    let host = await startPackagedServe(root, env);
    const request = (path: string, init: RequestInit = {}) =>
      fetch(`${host.baseUrl}/v1${path}`, {
        ...init,
        headers: { ...runtimeAuthorization(host.descriptor), ...init.headers },
      });
    const json = (path: string, body: unknown, method = "POST") =>
      request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      const created = await json("/projects", folderProjectInput({ name: "Immutable assets" }, root));
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const enabled = await json(`/projects/${project.id}/extensions/installed/asset-probe/enable`, {
        displayName: "Asset probe",
        extensionId: "e2e.asset-probe",
        manifest: { id: "e2e.asset-probe", name: "asset-probe" },
        name: "asset-probe",
        sourceHash: null,
        sourceKind: "local_path",
        sourcePath: source,
        sourceRef: null,
        version: "1.0.0",
      });
      expect(enabled.status).toBe(200);
      const { instanceId } = (await enabled.json()) as { instanceId: string };
      const base = `/projects/${project.id}/extensions/${instanceId}`;
      const operation = `${base}/asset-transfers/restart`;
      const expected = {
        sha256: createHash("sha256").update("abcdef").digest("hex"),
        byteLength: 6,
        mediaType: "application/octet-stream",
      };
      expect((await json(operation, { expected }, "PUT")).status).toBe(200);
      const append = (offset: number, body: string) =>
        request(`${operation}/content?offset=${offset}`, {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body,
        });
      expect(await (await append(0, "abc")).json()).toMatchObject({ status: "staging", uploadedByteLength: 3 });
      await stopProcess(host.child);
      host = await startPackagedServe(root, env);
      expect(await (await request(operation)).json()).toMatchObject({ status: "staging", uploadedByteLength: 3 });
      expect((await append(0, "abc")).status).toBe(409);
      expect((await append(3, "def")).status).toBe(200);
      expect(await (await request(`${operation}/complete`, { method: "POST" })).json()).toEqual({
        status: "complete",
        operationId: "restart",
        asset: expected,
      });
      const owner = { projectId: project.id, extensionInstanceId: instanceId };
      const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
      expect(await new Response(await client.assets.read({ ...owner, asset: expected })).text()).toBe("abcdef");
      const sourceBlob = new Blob(["SDK bytes"], { type: "application/example" });
      const uploaded = await client.assets.upload({ ...owner, operationId: "sdk", source: sourceBlob });
      expect(await client.assets.upload({ ...owner, operationId: "sdk", source: sourceBlob })).toEqual(uploaded);
      expect(await new Response(await client.assets.read({ ...owner, asset: uploaded })).text()).toBe("SDK bytes");
      expect((await client.assets.cancel({ ...owner, operationId: "restart" })).status).toBe("complete");
      const pending = { ...expected, sha256: "0".repeat(64) };
      await client.assets.begin({ ...owner, operationId: "cancel", expected: pending });
      expect((await client.assets.cancel({ ...owner, operationId: "cancel" })).status).toBe("cancelled");
      expect(await new Response(await client.assets.read({ ...owner, asset: expected })).text()).toBe("abcdef");
      const command = await json(
        `/projects/${project.id}/extensions/commands/e2e.asset-probe.command.stage/execute`,
        {},
      );
      expect(command.status).toBe(200);
      expect(await command.json()).toMatchObject({ outcome: { ok: true, value: { text: "extension bytes" } } });
      expect((await request(`${base}/asset-transfers/restart`.replace(project.id, crypto.randomUUID()))).status).toBe(
        404,
      );
    } finally {
      await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
