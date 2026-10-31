import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("packaged CLI file selection executes each selected test once without unrelated tests", async () => {
  const root = await mkdtemp(join(tmpdir(), "packaged-cli-selection-"));
  try {
    const owner = join(root, "packages/e2e");
    const directory = join(owner, "src/packaged");
    await mkdir(directory, { recursive: true });
    await cp(resolve(import.meta.dir, "../../../../scripts/ci"), join(root, "scripts/ci"), {
      recursive: true,
      filter: (path) => !path.endsWith(".test.ts"),
    });
    for (const file of ["run-packaged-cli-tests.ts", "packaged-test-timeout.ts"]) {
      await copyFile(join(import.meta.dir, file), join(directory, file));
    }
    await mkdir(join(owner, "src/scripts"), { recursive: true });
    await writeFile(join(owner, "src/scripts/bun-process-cleanup.ts"), "export {};");
    for (const name of ["selected", "unrelated"]) {
      await writeFile(
        join(directory, `${name}.p1.test.ts`),
        `import {test} from "bun:test";import {appendFileSync} from "node:fs";test("${name}",()=>appendFileSync("executed.txt","${name}\\n"));`,
      );
    }
    await mkdir(join(owner, "src/cli"), { recursive: true });
    await writeFile(
      join(owner, "src/cli/outside.p1.test.ts"),
      'import {test} from "bun:test";test("outside packaged suite",()=>{throw new Error("outside suite executed");});',
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
    const run = async (args: string[]) => {
      await rm(join(owner, "executed.txt"), { force: true });
      const child = Bun.spawn([process.execPath, "src/packaged/run-packaged-cli-tests.ts", ...args], {
        cwd: owner,
        env: { ...process.env, TEST_PRIORITIES: "P1", CI_SOURCE_COVERAGE: "0" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
      return (await Bun.file(join(owner, "executed.txt")).text()).trim().split("\n").sort();
    };
    expect(await run(["src/packaged/selected.p1.test.ts"])).toEqual(["selected"]);
    expect(await run(["src/packaged/selected.p1.test.ts", "src/packaged/unrelated.p1.test.ts"])).toEqual([
      "selected",
      "unrelated",
    ]);
    expect(await run([])).toEqual(["selected", "unrelated"]);
    expect(await run(["--test-name-pattern", "selected|unrelated"])).toEqual(["selected", "unrelated"]);
    expect(await run(["--path-ignore-patterns=**/unrelated.p1.test.ts"])).toEqual(["selected"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
