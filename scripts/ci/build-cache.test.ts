import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBuildCache } from "./build-cache";

test("portable task archives survive a cache server restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ci-build-cache-"));
  let server = createBuildCache(directory);
  try {
    const path = "/v1/cache/123456789";
    expect((await fetch(new URL(path, server.url))).status).toBe(404);
    const bytes = new Uint8Array([0, 255, 12, 34]);
    expect((await fetch(new URL(path, server.url), { method: "PUT", body: bytes })).status).toBe(200);
    expect((await fetch(new URL(path, server.url), { method: "PUT", body: new Uint8Array([99]) })).status).toBe(409);
    await server.stop(true);
    server = createBuildCache(directory);
    expect(new Uint8Array(await (await fetch(new URL(path, server.url))).arrayBuffer())).toEqual(bytes);
    expect(server.hostname).toBe("127.0.0.1");
  } finally {
    await server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
