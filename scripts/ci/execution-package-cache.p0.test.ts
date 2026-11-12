import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { copyCiRuntime, isolateCiRuntimeEnvironment } from "./copy-ci-runtime.test-fixture";
import { executePlan } from "./run-test-plan";
import { createTestPlan, sealTestPlan } from "./test-plan";
import { testPlanSource } from "./test-plan-source";

for (const interrupted of [false, true])
  test(`compatible priority runs retain their execution-owned package cache until ${interrupted ? "interrupted" : "final"} cleanup`, async () => {
    const root = await mkdtemp(join(tmpdir(), "execution-package-cache-"));
    const restoreEnvironment = isolateCiRuntimeEnvironment();
    let registry: ReturnType<typeof Bun.serve> | undefined;
    try {
      await copyCiRuntime(root);
      await writeFile(join(root, ".gitignore"), "test-results/\nnode_modules/\n");
      await copyFile(resolve(import.meta.dir, "../package.json"), join(root, "scripts/package.json"));
      await mkdir(join(root, "node_modules"));
      await symlink(join(root, "scripts"), join(root, "node_modules/pstdio-scripts"), "junction");
      const source = resolve(import.meta.dir, "../../packages/e2e/src");
      const target = join(root, "packages/e2e/src");
      await cp(join(source, "scripts"), join(target, "scripts"), {
        recursive: true,
        filter: (path) => !path.endsWith(".test.ts"),
      });
      for (const file of [
        "local-workspace-registry.ts",
        "packaged/run-packaged-cli-tests.ts",
        "packaged/packaged-test-timeout.ts",
        "packaged/prepared-packaged-consumers.ts",
        "packaged/packaged-extension-source.ts",
        "packaged/packaged-package-cache.ts",
      ]) {
        await mkdir(dirname(join(target, file)), { recursive: true });
        await copyFile(join(source, file), join(target, file));
      }
      // Tiny public artifacts exercise the actual adapter, without unrelated extension installs.
      for (const name of ["sdk", "ui"]) {
        const pkg = join(root, "packages", name);
        await mkdir(pkg, { recursive: true });
        await writeFile(join(pkg, "package.json"), JSON.stringify({ name: `@pstdio/${name}`, version: "1.0.0" }));
      }
      const dependencyName = "fixture-completed-cache-dependency";
      const dependency = join(root, "dependency");
      await mkdir(dependency);
      await writeFile(join(dependency, "package.json"), JSON.stringify({ name: dependencyName, version: "1.0.0" }));
      await writeFile(join(dependency, "value.txt"), "fresh installed payload");
      expect(Bun.spawnSync([process.execPath, "pm", "pack", "--destination", root], { cwd: dependency }).exitCode).toBe(
        0,
      );
      let downloads = 0;
      registry = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch(request) {
          if (new URL(request.url).pathname.endsWith(".tgz")) {
            downloads++;
            return new Response(Bun.file(join(root, `${dependencyName}-1.0.0.tgz`)));
          }
          return Response.json({
            name: dependencyName,
            "dist-tags": { latest: "1.0.0" },
            versions: {
              "1.0.0": {
                name: dependencyName,
                version: "1.0.0",
                dist: { tarball: new URL("/package.tgz", request.url).href },
              },
            },
          });
        },
      });
      const config = join(root, ".npmrc");
      await writeFile(config, `registry=${registry.url.origin}/\n`);
      const extension = join(root, "extensions/fixture");
      await mkdir(extension, { recursive: true });
      await writeFile(
        join(extension, "package.json"),
        JSON.stringify({ name: "fixture", dependencies: { [dependencyName]: "1.0.0" } }),
      );
      const record = join(root, "test-results/consumers.jsonl");
      const holding = join(root, "test-results/holding");
      const files = ["p0", "p1"].map((priority) => `packages/e2e/src/packaged/cache.${priority}.test.ts`);
      for (const [index, file] of files.entries())
        await writeFile(
          join(root, file),
          `import {test,expect} from 'bun:test';
          import {appendFileSync,cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
          import {basename,join} from 'node:path';
          import {stagePackagedPackageCache} from './packaged-package-cache';
          test('fresh offline runtime installation',async()=>{
            const cache=process.env.E2E_BUN_CACHE_DIR!;
            const payload=join(cache,'payload');
            expect(existsSync(payload)).toBe(${index === 1});
            mkdirSync(cache,{recursive:true});
            writeFileSync(payload,'retained');
            const source=JSON.parse(process.env.E2E_EXTENSION_SOURCES!).fixture;
            expect(existsSync(join(source,'node_modules'))).toBe(false);
            const runtime=join(process.env.E2E_HOME!,'runtime');
            const installedSource=join(runtime,'extension');
            cpSync(source,installedSource,{recursive:true,filter:path=>basename(path)!=='node_modules'});
            stagePackagedPackageCache(runtime);
            const installed=Bun.spawnSync([process.execPath,'install','--offline','--frozen-lockfile','--ignore-scripts'],{
              cwd:installedSource,env:{...process.env,BUN_INSTALL_CACHE_DIR:join(runtime,'cache/extension-bun-install')},
            });
            expect(installed.exitCode,installed.stderr.toString()).toBe(0);
            expect(readFileSync(join(installedSource,'node_modules',${JSON.stringify(dependencyName)},'value.txt'),'utf8')).toBe('fresh installed payload');
            appendFileSync(${JSON.stringify(record)},JSON.stringify({cache,home:process.env.E2E_HOME})+${JSON.stringify("\n")});
            ${interrupted && index === 1 ? `writeFileSync(${JSON.stringify(holding)},'ready');await Bun.sleep(10000);` : ""}
          });`,
        );
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync(
        "git",
        ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"],
        { cwd: root },
      );
      const { digest: _digest, ...body } = createTestPlan({
        source: testPlanSource(root),
        target: { platform: process.platform, arch: process.arch },
        packages: [{ name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} }],
        artifact: "compiled-cli",
        files,
      });
      const plan = sealTestPlan({
        ...body,
        setup: body.setup.map((step) => (step.kind === "extension-fixtures" ? { ...step, owners: ["fixture"] } : step)),
      });
      const controller = new AbortController();
      const execution = executePlan(plan, {
        root,
        prebuilt: true,
        env: {
          E2E_FIXTURE_EXTENSIONS: '["fixture"]',
          NPM_CONFIG_USERCONFIG: config,
          NPM_CONFIG_REGISTRY: registry.url.origin,
        },
        signal: controller.signal,
      });
      let consumerStarted = false;
      if (interrupted) {
        const deadline = Date.now() + 4000;
        while (!(await Bun.file(holding).exists()) && Date.now() < deadline) await Bun.sleep(10);
        consumerStarted = await Bun.file(holding).exists();
        controller.abort("interrupted consumer with populated cache");
      }
      const result = await execution;
      if (interrupted) expect(consumerStarted).toBe(true);
      expect(result).toMatchObject({ outcome: interrupted ? "failure" : "success", complete: !interrupted });
      const consumers = (await readFile(record, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(consumers).toHaveLength(2);
      expect(downloads).toBe(1);
      expect(consumers[0].home).not.toBe(consumers[1].home);
      expect(consumers[0].cache).toBe(consumers[1].cache);
      // Payload writes must use the host's temporary storage, independently of report placement.
      expect(consumers[0].cache.startsWith(root + sep)).toBe(false);
      for (const consumer of consumers) {
        expect(await Bun.file(join(consumer.cache, "payload")).exists()).toBe(false);
        expect(await Bun.file(join(consumer.home, "fixtures/sources.json")).exists()).toBe(false);
      }
      expect(result.phases.find((phase) => phase.kind === "cleanup")).toMatchObject({
        outcome: "success",
        complete: true,
      });
    } finally {
      registry?.stop(true);
      await rm(root, { recursive: true, force: true });
      restoreEnvironment();
    }
  });
