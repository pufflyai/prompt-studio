import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = await mkdtemp(join(tmpdir(), "ps775-os-lock-"));
const owner = `pstdio-os-lock-${randomUUID()}`;
const repo = resolve(import.meta.dir, "../../../..");
const manifest = process.env.PSTDIO_LOCAL_REVIEW_COMPOSE_MANIFEST;
const composeFile = join(manifest ? dirname(manifest) : root, `${owner}.json`);
const compose = ["docker", "compose", "--file", composeFile, "--project-name", owner];
await mkdir(dirname(composeFile), { recursive: true });
await writeFile(
  composeFile,
  JSON.stringify({
    services: {
      prepare: {
        image: "oven/bun:1.4.4",
        user: "0:0",
        volumes: ["database:/database"],
        command: ["bun", "-e", "import {chmodSync} from 'node:fs';chmodSync('/database',0o777)"],
      },
      lock: {
        image: "oven/bun:1.4.4",
        user: `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        working_dir: "/work",
        volumes: [`${repo}:/work`, `${root}:/owned`, "database:/database"],
      },
    },
    volumes: { database: {} },
  }),
);
if (manifest) await appendFile(manifest, `${JSON.stringify({ project: owner, file: composeFile })}\n`);
const run = async (command: string[]) => {
  const p = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [output, error] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { code: await p.exited, output, error };
};
const waitForReady = async (container: string, readyPath: string, signal?: AbortSignal) => {
  while (!(await Bun.file(readyPath).exists())) {
    signal?.throwIfAborted();
    const inspected = await run(["docker", "inspect", "--format", "{{json .State}}", container]);
    if (inspected.code) throw new Error(`Cannot inspect owned lock container: ${inspected.error}`);
    const state = JSON.parse(inspected.output) as { Running: boolean; ExitCode: number };
    if (!state.Running) {
      const logs = await run(["docker", "logs", container]);
      throw new Error(`Owned lock container exited (${state.ExitCode}) before readiness:\n${logs.output}${logs.error}`);
    }
    await Bun.sleep(20);
  }
};
const runLock = (options: string[], script: string) =>
  run([...compose, "run", ...options, "lock", "bun", "-e", script]);
try {
  const initialized = await run([...compose, "run", "--rm", "prepare"]);
  if (initialized.code) throw new Error(initialized.error);
  const failedOwner = `${owner}-failed`;
  try {
    const failed = await runLock(["--detach", "--name", failedOwner], "throw new Error('Owned startup failure')");
    if (failed.code) throw new Error(failed.error);
    const error = await waitForReady(failedOwner, join(root, "never-ready"), AbortSignal.timeout(1000)).catch(
      (error: unknown) => error,
    );
    assert.match(String(error), /Owned startup failure/);
  } finally {
    await run(["docker", "rm", "-f", failedOwner]);
  }
  const first = await runLock(
    ["--detach", "--name", owner],
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts'; acquirePgliteLock('/database/database'); await Bun.write('/owned/ready','ready');setInterval(()=>{},1000)`,
  );
  if (first.code) throw new Error(first.error);
  await waitForReady(owner, join(root, "ready"));
  const contender = await runLock(
    ["--rm"],
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts';try {acquirePgliteLock('/database/database'); process.exit(3)}catch(e){if(!e.message.includes('refusing'))throw e; console.log('Live foreign container owner denied');}`,
  );
  if (contender.code) throw new Error(contender.error);
  console.log(contender.output.trim());
  const legacy = await runLock(
    ["--rm"],
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-legacy-lock.fixture.ts';try {acquirePgliteLock('/database/database'); process.exit(3)}catch{console.log('Legacy foreign container excluded by the format fence');}`,
  );
  if (legacy.code) throw new Error(legacy.error);
  console.log(legacy.output.trim());
  await run(["docker", "kill", "--signal=KILL", owner]);
  const replacement = await runLock(
    ["--rm"],
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts';acquirePgliteLock('/database/database')(); console.log('Killed foreign container owner reclaimed safely');`,
  );
  if (replacement.code) throw new Error(replacement.error);
  console.log(replacement.output.trim());
} finally {
  await run(["docker", "rm", "-f", owner]);
  const cleaned = await run([...compose, "down", "--volumes", "--remove-orphans"]);
  if (cleaned.code) {
    console.error(cleaned.error);
    process.exitCode = 1;
  }
  await rm(root, { recursive: true, force: true });
}
