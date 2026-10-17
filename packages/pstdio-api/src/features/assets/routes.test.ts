import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";

test("asset routes publish verified bytes, resume by offset, and enforce the installed extension owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-routes-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const handle = await createTestApp({ storageRoot: join(root, "storage") });
  const json = (path: string, body: unknown, method = "POST") =>
    handle.app.request(`/v1${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const response = await json("/projects", folderProjectInput({ name: "Assets" }));
    expect(response.status).toBe(201);
    const project = await response.json();
    const sourcePath = join(root, "example");
    await mkdir(sourcePath);
    await writeFile(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "example",
        version: "1.0.0",
        publisher: "example",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(sourcePath, "extension.ts"),
      `export default { commands: [{
      id: "stage", ref: { kind: "command", id: "stage" }, title: "Stage bytes",
      run: async (ctx) => {
        const asset = await ctx.storage.assets.stage({ operationId: "command", source: new Blob(["command bytes"], { type: "text/plain" }) });
        await ctx.storage.assets.verifyComplete([asset]);
        return { asset, text: await new Response(await ctx.storage.assets.read(asset)).text() };
      },
    }] };`,
    );
    const enabled = await json(`/projects/${project.id}/extensions/installed/example/enable`, {
      displayName: "Example",
      extensionId: "example.example",
      manifest: { id: "example.example", name: "example" },
      name: "example",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    });
    expect(enabled.status).toBe(200);
    const { instanceId } = await enabled.json();
    const base = `/projects/${project.id}/extensions/${instanceId}`;
    const command = await json(`/projects/${project.id}/extensions/commands/example.example.command.stage/execute`, {});
    expect(command.status).toBe(200);
    expect(await command.json()).toMatchObject({
      outcome: { ok: true, value: { text: "command bytes", asset: { byteLength: 13 } } },
    });
    const operation = `${base}/asset-transfers/upload`;
    const expected = {
      sha256: createHash("sha256").update("abcdef").digest("hex"),
      byteLength: 6,
      mediaType: "text/plain",
    };
    const start = await json(operation, { expected }, "PUT");
    expect(start.status).toBe(200);
    expect(await start.json()).toMatchObject({ status: "staging", uploadedByteLength: 0 });
    const query = new URLSearchParams({ byteLength: "6", mediaType: "text/plain" });
    const content = `/v1${base}/assets/${expected.sha256}/content?${query}`;
    expect((await handle.app.request(content)).status).toBe(404);
    const append = (offset: number, body: string) =>
      handle.app.request(`/v1${operation}/content?offset=${offset}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body,
      });
    expect(await (await append(0, "abc")).json()).toMatchObject({ status: "staging", uploadedByteLength: 3 });
    expect((await append(0, "abc")).status).toBe(409);
    expect((await json(`${operation}/complete`, {})).status).toBe(422);
    expect((await handle.app.request(content)).status).toBe(404);
    expect((await append(3, "def")).status).toBe(200);
    expect(await (await json(`${operation}/complete`, {})).json()).toEqual({
      status: "complete",
      operationId: "upload",
      asset: expected,
    });
    const download = await handle.app.request(content);
    expect(download.status).toBe(200);
    expect(await download.text()).toBe("abcdef");
    expect((await json(operation, { expected: { ...expected, mediaType: "other" } }, "PUT")).status).toBe(409);
    expect((await json(operation, { expected, accountId: "fake-owner" }, "PUT")).status).toBe(400);
    expect((await handle.app.request(content.replace(instanceId, crypto.randomUUID()))).status).toBe(404);
    expect((await handle.app.request(content.replace(project.id, crypto.randomUUID()))).status).toBe(404);
    const cancelled = `${base}/asset-transfers/cancel`;
    await json(cancelled, { expected: { ...expected, sha256: "0".repeat(64) } }, "PUT");
    expect(await (await handle.app.request(`/v1${cancelled}`, { method: "DELETE" })).json()).toMatchObject({
      status: "cancelled",
    });
    expect((await handle.app.request(content)).status).toBe(200);
    const legacyUpload = await handle.app.request(`/v1${base}/files`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-file-name": "large.bin" },
      body: new Blob([new Uint8Array(26 * 1024 * 1024)]).stream(),
    });
    expect(legacyUpload.status).toBe(201);
    expect(await legacyUpload.json()).toMatchObject({ name: "large.bin", size: 26 * 1024 * 1024 });
  } finally {
    await handle.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
    await rm(root, { recursive: true, force: true });
  }
});
