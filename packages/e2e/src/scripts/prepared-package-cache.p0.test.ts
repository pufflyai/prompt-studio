import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { stagePackagedPackageCache } from "../packaged/packaged-package-cache";
import { prepareUiFixtures } from "./prepare-ui-fixtures";

test("a reused private consumer retains the runner's package-cache prerequisite for fresh offline installs", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-package-cache-"));
  let server: ReturnType<typeof Bun.serve> | undefined;
  try {
    const name = "fixture-prepared-cache-dependency";
    const dependency = join(root, "dependency");
    mkdirSync(dependency);
    writeFileSync(join(dependency, "package.json"), JSON.stringify({ name, version: "1.0.0", main: "index.js" }));
    writeFileSync(join(dependency, "index.js"), "export const value='fresh';");
    expect(Bun.spawnSync([process.execPath, "pm", "pack", "--destination", root], { cwd: dependency }).exitCode).toBe(
      0,
    );
    let downloads = 0;
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname.endsWith(".tgz")) {
          downloads++;
          return new Response(Bun.file(join(root, `${name}-1.0.0.tgz`)));
        }
        return Response.json({
          name,
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": { name, version: "1.0.0", dist: { tarball: new URL("/package.tgz", request.url).href } },
          },
        });
      },
    });
    const prepared = join(root, "prepared");
    const source = join(prepared, "source");
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({ name: "fixture-consumer", dependencies: { [name]: "1.0.0" } }),
    );
    writeFileSync(join(prepared, "sources.json"), JSON.stringify({ fixture: source }));
    const config = join(root, ".npmrc");
    writeFileSync(config, `registry=${server.url.origin}/\n`);
    const cache = join(root, "cache");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NPM_CONFIG_USERCONFIG: config,
      E2E_HOME: join(root, "consumer"),
      E2E_BUN_CACHE_DIR: cache,
      E2E_PREPARED_FIXTURES: prepared,
      E2E_FIXTURE_EXTENSIONS: '["fixture"]',
    };
    const lock = Bun.spawn([process.execPath, "install", "--lockfile-only", "--ignore-scripts"], {
      cwd: source,
      env: { ...env, BUN_INSTALL_CACHE_DIR: cache },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await lock.exited, await new Response(lock.stderr).text()).toBe(0);
    expect(downloads).toBe(0);
    const originalLock = readFileSync(join(source, "bun.lock"), "utf8");
    await prepareUiFixtures(env, new AbortController().signal);
    server.stop(true);
    const copied = JSON.parse(env.E2E_EXTENSION_SOURCES!).fixture as string;
    const runtimeHome = join(root, "runtime");
    const runtimeSource = join(runtimeHome, "extension");
    cpSync(copied, runtimeSource, { recursive: true, filter: (path) => basename(path) !== "node_modules" });
    stagePackagedPackageCache(runtimeHome, cache);
    const installed = Bun.spawnSync(
      [process.execPath, "install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      {
        cwd: runtimeSource,
        env: { ...env, BUN_INSTALL_CACHE_DIR: join(runtimeHome, "cache/extension-bun-install") },
      },
    );
    expect(installed.exitCode, installed.stderr.toString()).toBe(0);
    expect(downloads).toBe(1);
    expect(existsSync(join(source, "node_modules"))).toBe(false);
    expect(readFileSync(join(source, "bun.lock"), "utf8")).toBe(originalLock);
    expect(await Bun.file(join(runtimeSource, "node_modules", name, "index.js")).text()).toContain("fresh");
  } finally {
    server?.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
});
