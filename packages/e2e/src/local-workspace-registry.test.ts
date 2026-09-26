import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packWorkspacePackageTarball, startLocalWorkspaceRegistry } from "./local-workspace-registry";

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-registry-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const name = "@pstdio/registry-fixture";
  const writePackage = async (version: string) => {
    const path = join(root, version);
    await Bun.write(join(path, "package.json"), JSON.stringify({ name, version, files: ["index.ts"] }));
    await Bun.write(join(path, "index.ts"), `export const release = '${version}';\n`);
    return path;
  };
  return { root, name, writePackage };
};

describe("local workspace package registry", () => {
  test("installs an older published dependency while serving the local release", async () => {
    const { root, name, writePackage } = await fixture();
    const oldPackage = await writePackage("0.25.0");
    const oldTarball = packWorkspacePackageTarball(oldPackage, join(root, "published"));
    let tarballRequests = 0;
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => {
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        if (pathname === "/old.tgz") {
          tarballRequests++;
          return new Response(Bun.file(oldTarball));
        }
        expect(pathname).toBe(`/${name}`);
        return Response.json({
          name,
          "dist-tags": { latest: "0.25.0", next: "0.27.0-beta.1" },
          versions: {
            "0.25.0": { name, version: "0.25.0", dist: { tarball: new URL("/old.tgz", request.url).href } },
          },
        });
      },
    });
    cleanups.push(async () => upstream.stop(true));
    const consumer = join(root, "consumer");
    await Bun.write(join(consumer, "package.json"), JSON.stringify({ dependencies: { [name]: "^0.25.0" } }));
    const registry = await startLocalWorkspaceRegistry({
      configPath: join(consumer, ".npmrc"),
      outputRoot: join(root, "packed"),
      packagePaths: [await writePackage("0.26.0")],
      upstreamOrigin: upstream.url.origin,
    });
    cleanups.push(registry.close);
    const metadata = await fetch(`${registry.origin}/${name}`).then((response) => response.json());
    expect(metadata.versions["0.25.0"].version).toBe("0.25.0");
    expect(metadata["dist-tags"]).toEqual({ latest: "0.26.0", next: "0.27.0-beta.1" });
    const localTarball = await fetch(metadata.versions["0.26.0"].dist.tarball);
    expect(localTarball.status).toBe(200);
    expect((await localTarball.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const install = Bun.spawn(["bun", "install", "--ignore-scripts", "--cache-dir", join(root, "cache")], {
      cwd: consumer,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([install.exited, new Response(install.stderr).text()]);
    expect(stderr).not.toContain("error:");
    expect(exitCode).toBe(0);
    expect(await Bun.file(join(consumer, "node_modules", name, "package.json")).json()).toMatchObject({
      version: "0.25.0",
    });
    expect(tarballRequests).toBe(1);
  });

  test("starts without contacting npm and serves local packages when npm is unavailable", async () => {
    const { root, name, writePackage } = await fixture();
    let requests = 0;
    const upstream = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => {
        requests++;
        return new Response("Unavailable", { status: 503 });
      },
    });
    cleanups.push(async () => upstream.stop(true));
    const registry = await startLocalWorkspaceRegistry({
      configPath: join(root, ".npmrc"),
      outputRoot: join(root, "packed"),
      packagePaths: [await writePackage("0.26.0")],
      upstreamOrigin: upstream.url.origin,
    });
    cleanups.push(registry.close);
    expect(requests).toBe(0);
    const response = await fetch(`${registry.origin}/${name}`);
    expect(response.status).toBe(200);
    const metadata = await response.json();
    expect(metadata.versions["0.26.0"].version).toBe("0.26.0");
    expect((await fetch(metadata.versions["0.26.0"].dist.tarball)).status).toBe(200);
  });
});
