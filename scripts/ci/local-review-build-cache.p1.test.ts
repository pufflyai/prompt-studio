import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { startLocalReviewBuildCache } from "./local-review-build-cache";
import { localReviewEnvironment } from "./local-review-source";

const nx = dirname(createRequire(require.resolve("lerna/package.json")).resolve("nx/package.json"));
const fixture = (root: string) => {
  mkdirSync(join(root, "node_modules"), { recursive: true });
  symlinkSync(nx, join(root, "node_modules/nx"), "junction");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "cache-fixture", private: true }));
  cpSync(join(import.meta.dir, "../../nx.json"), join(root, "nx.json"));
  writeFileSync(join(root, ".gitignore"), "node_modules\n.nx\n**/dist\n");
  for (const name of ["producer", "consumer"]) {
    const directory = join(root, name);
    mkdirSync(directory);
    writeFileSync(join(directory, "value.txt"), "original");
    writeFileSync(
      join(directory, "project.json"),
      JSON.stringify({
        name,
        implicitDependencies: name === "consumer" ? ["producer"] : [],
        targets: {
          build: {
            executor: "nx:run-commands",
            options: { command: "bun build.ts", cwd: name },
          },
        },
      }),
    );
    writeFileSync(
      join(directory, "build.ts"),
      `import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
       if (readFileSync('value.txt','utf8') === 'fail') process.exit(1);
       appendFileSync(process.env.BUILD_EXECUTION_LOG, ${JSON.stringify(name)}+'\\n');
       mkdirSync('dist',{recursive:true});
       writeFileSync('dist/output.txt',readFileSync('value.txt','utf8')+':' + process.env.NODE_ENV
         + ${name === "consumer" ? "readFileSync('../producer/value.txt','utf8')" : "''"});`,
    );
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
};

test("real Nx restores private outputs and invalidates changed sources, dependencies and build environment", async () => {
  const directory = mkdtempSync(join(tmpdir(), "local-review-nx-"));
  const first = join(directory, "first");
  const second = join(directory, "second");
  fixture(first);
  fixture(second);
  const cache = startLocalReviewBuildCache(first);
  const executions = join(directory, "executions");
  const counts = () => readFileSync(executions, "utf8").trim().split("\n");
  const run = async (root: string, nodeEnv = "production") => {
    const started = performance.now();
    const child = Bun.spawn(["node", join(nx, "bin/nx.js"), "run", "consumer:build", "--outputStyle=static"], {
      cwd: root,
      env: {
        ...localReviewEnvironment(root),
        NODE_ENV: nodeEnv,
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: cache.server!.url.origin,
        NX_ISOLATE_PLUGINS: "false",
        BUILD_EXECUTION_LOG: executions,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    console.log(`Nx fixture ${nodeEnv}: ${Math.round(performance.now() - started)}ms, exit ${code}`);
    if (code && !stdout.includes("consumer:build")) console.error(stdout, stderr);
    return code;
  };
  try {
    expect(cache.error).toBeUndefined();
    expect(await run(first)).toBe(0);
    expect(counts()).toHaveLength(2);
    expect(cache.statistics.stored).toBe(2);
    expect(await run(second)).toBe(0);
    expect(counts()).toHaveLength(2);
    expect(cache.statistics.hits).toBe(2);
    const output = join(second, "consumer/dist/output.txt");
    writeFileSync(join(first, "consumer/dist/output.txt"), "private mutation");
    expect(readFileSync(output, "utf8")).toBe("original:productionoriginal");
    writeFileSync(join(second, "producer/value.txt"), "changed");
    expect(await run(second)).toBe(0);
    expect(counts()).toHaveLength(4);
    expect(readFileSync(output, "utf8")).toBe("original:productionchanged");
    expect(await run(second, "development")).toBe(0);
    expect(counts()).toHaveLength(6);
    expect(readFileSync(output, "utf8")).toBe("original:developmentchanged");
    writeFileSync(join(second, "consumer/value.txt"), "fail");
    const stored = cache.statistics.stored;
    expect(await run(second, "development")).not.toBe(0);
    expect(cache.statistics.stored).toBe(stored);
  } finally {
    await cache.server?.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
