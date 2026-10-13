import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freshInstallArgs } from "./fresh-install";

test("fresh installs reject recent third-party releases and accept recent Prompt Studio releases", async () => {
  const root = mkdtempSync(join(tmpdir(), "fresh-install-age-"));
  const names = ["third-party-age-fixture", "@pstdio/age-fixture"];
  const versions = ["1.0.0", "1.1.0"];
  const archives = new Map<string, string>();
  mkdirSync(join(root, ".changeset"));
  writeFileSync(join(root, ".changeset/config.json"), JSON.stringify({ fixed: [names] }));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, registry) {
      const name = decodeURIComponent(new URL(request.url).pathname.slice(1));
      if (name.startsWith("archives/")) {
        const archive = archives.get(name.slice("archives/".length));
        return archive ? new Response(Bun.file(archive)) : new Response(null, { status: 404 });
      }
      if (!names.includes(name)) return new Response(null, { status: 404 });
      return Response.json({
        name,
        "dist-tags": { latest: "1.1.0" },
        versions: Object.fromEntries(
          versions.map((version) => [
            version,
            { name, version, dist: { tarball: `${registry.url}archives/${name.replace("/", "-")}-${version}` } },
          ]),
        ),
        time: {
          "1.0.0": new Date(Date.now() - 7 * 86_400_000).toISOString(),
          "1.1.0": new Date(Date.now() - 60_000).toISOString(),
        },
      });
    },
  });
  try {
    for (const name of names) {
      for (const version of versions) {
        const key = `${name.replace("/", "-")}-${version}`;
        const directory = join(root, key);
        mkdirSync(join(directory, "package"), { recursive: true });
        writeFileSync(join(directory, "package/package.json"), JSON.stringify({ name, version }));
        const archive = join(directory, "package.tgz");
        const packed = Bun.spawnSync(["tar", "-czf", archive, "-C", directory, "package"]);
        expect(packed.exitCode, packed.stderr.toString()).toBe(0);
        archives.set(key, archive);
      }
    }
    const directory = join(root, "consumer");
    mkdirSync(directory);
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ name: "age-consumer", dependencies: Object.fromEntries(names.map((name) => [name, "^1.0.0"])) }),
    );
    const child = Bun.spawn(
      [process.execPath, ...freshInstallArgs(root, directory), "--cache-dir", join(root, "cache")],
      {
        cwd: directory,
        env: { ...process.env, BUN_CONFIG_REGISTRY: String(server.url) },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    expect((await Bun.file(join(directory, "node_modules", names[0], "package.json")).json()).version).toBe("1.0.0");
    expect((await Bun.file(join(directory, "node_modules", names[1], "package.json")).json()).version).toBe("1.1.0");
  } finally {
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
});
