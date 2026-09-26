import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalWorkspaceRegistry } from "./local-workspace-registry";

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("local workspace package registry", () => {
  test("serves the local release alongside older published dependency versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "workspace-registry-"));
    cleanups.push(() => rm(root, { recursive: true, force: true }));
    const name = "@pstdio/registry-fixture";
    const published = {
      name,
      "dist-tags": { latest: "0.25.0", next: "0.27.0-beta.1" },
      versions: { "0.25.0": { name, version: "0.25.0", dist: { tarball: "https://example.test/old.tgz" } } },
    };
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => {
        expect(decodeURIComponent(new URL(request.url).pathname)).toBe(`/${name}`);
        return Response.json(published);
      },
    });
    cleanups.push(async () => upstream.stop(true));
    const packagePath = join(root, "fixture");
    await Bun.write(
      join(packagePath, "package.json"),
      JSON.stringify({ name, version: "0.26.0", files: ["index.ts"] }),
    );
    await Bun.write(join(packagePath, "index.ts"), "export const release = 'local';\n");
    const registry = await startLocalWorkspaceRegistry({
      configPath: join(root, ".npmrc"),
      outputRoot: join(root, "packed"),
      packagePaths: [packagePath],
      upstreamOrigin: upstream.url.origin,
    });
    cleanups.push(registry.close);

    const response = await fetch(`${registry.origin}/${name}`);
    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.versions["0.25.0"]).toEqual(published.versions["0.25.0"]);
    expect(metadata.versions["0.26.0"].version).toBe("0.26.0");
    expect(metadata["dist-tags"]).toEqual({ latest: "0.26.0", next: "0.27.0-beta.1" });
    const tarball = await fetch(metadata.versions["0.26.0"].dist.tarball);
    expect(tarball.status).toBe(200);
    expect((await tarball.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
