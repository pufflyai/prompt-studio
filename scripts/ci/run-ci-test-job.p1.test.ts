import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const driver = join(import.meta.dirname, "run-ci-test-job.ts");
const environment = {
  ...process.env,
  LERNA_FILTER: "",
  PLAN_JOB: "assigned job with spaces",
  PLAN_PREBUILT: "true",
  PLAN_DISPLAY: "false",
};
const stopFixture = async (root: string) => {
  if (!(await Bun.file(join(root, "ready")).exists())) return;
  try {
    process.kill(Number(await readFile(join(root, "ready"), "utf8")), "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
};

test("the native job launcher preserves arguments, tool PATH and the executor exit status", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-test-job-"));
  try {
    await mkdir(join(root, "scripts"));
    await writeFile(
      join(root, "scripts/test.ts"),
      `
      await Bun.write('observed.json', JSON.stringify({ args: process.argv.slice(2), path: process.env.PATH }));
      process.exit(7);
    `,
    );
    const child = Bun.spawn([process.execPath, driver], {
      cwd: root,
      env: environment,
      stdio: ["ignore", "ignore", "inherit"],
    });
    expect(await child.exited).toBe(7);
    expect(JSON.parse(await readFile(join(root, "observed.json"), "utf8"))).toEqual({
      args: ["--plan", "test-results/ci/plan.json", "--job", environment.PLAN_JOB, "--prebuilt"],
      path: process.env.PATH,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32")(
  "interruption waits for executor cleanup and cannot become success",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "native-test-interruption-"));
    let child: ReturnType<typeof Bun.spawn> | undefined;
    try {
      await mkdir(join(root, "scripts"));
      await writeFile(
        join(root, "scripts/test.ts"),
        `
      import {writeFileSync} from 'node:fs';
      const interval = setInterval(() => {}, 1000);
      process.on('SIGTERM', () => {
        clearInterval(interval);
        setTimeout(() => {writeFileSync('cleaned', 'complete'); process.exit(0);}, 50);
      });
      writeFileSync('ready', String(process.pid));
    `,
      );
      child = Bun.spawn([process.execPath, driver], {
        cwd: root,
        env: environment,
        stdio: ["ignore", "ignore", "inherit"],
      });
      const deadline = Date.now() + 3000;
      while (!(await Bun.file(join(root, "ready")).exists()) && Date.now() < deadline) await Bun.sleep(10);
      expect(await Bun.file(join(root, "ready")).exists()).toBe(true);
      child.kill("SIGTERM");
      expect(await child.exited).toBe(1);
      expect(await readFile(join(root, "cleaned"), "utf8")).toBe("complete");
    } finally {
      if (child?.exitCode === null) child.kill("SIGKILL");
      await child?.exited;
      await stopFixture(root);
      await rm(root, { recursive: true, force: true });
    }
  },
);
