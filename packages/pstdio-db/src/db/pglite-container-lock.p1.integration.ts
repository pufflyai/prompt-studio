import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = await mkdtemp(join(tmpdir(), "ps775-os-lock-"));
const owner = `pstdio-os-lock-${randomUUID()}`;
const repo = resolve(import.meta.dir, "../../../..");
const args = [
  "docker",
  "run",
  "--rm",
  "--user",
  `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  "-v",
  `${repo}:/work`,
  "-v",
  `${root}:/owned`,
  "-w",
  "/work",
  "oven/bun:1.4.4",
  "bun",
  "-e",
];
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
try {
  const failedOwner = `${owner}-failed`;
  try {
    const failed = await run([
      ...args.slice(0, 2),
      "-d",
      "--name",
      failedOwner,
      ...args.slice(3),
      "throw new Error('Owned startup failure')",
    ]);
    if (failed.code) throw new Error(failed.error);
    const error = await waitForReady(failedOwner, join(root, "never-ready"), AbortSignal.timeout(1000)).catch(
      (error: unknown) => error,
    );
    assert.match(String(error), /Owned startup failure/);
  } finally {
    await run(["docker", "rm", "-f", failedOwner]);
  }
  const first = await run([
    ...args.slice(0, 2),
    "-d",
    "--name",
    owner,
    ...args.slice(3),
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts'; acquirePgliteLock('/owned/database'); await Bun.write('/owned/ready','ready');setInterval(()=>{},1000)`,
  ]);
  if (first.code) throw new Error(first.error);
  await waitForReady(owner, join(root, "ready"));
  const contender = await run([
    ...args,
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts';try {acquirePgliteLock('/owned/database'); process.exit(3)}catch(e){if(!e.message.includes('refusing'))throw e; console.log('Live foreign container owner denied');}`,
  ]);
  if (contender.code) throw new Error(contender.error);
  console.log(contender.output.trim());
  const legacy = await run([
    ...args,
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-legacy-lock.fixture.ts';try {acquirePgliteLock('/owned/database'); process.exit(3)}catch{console.log('Legacy foreign container excluded by the format fence');}`,
  ]);
  if (legacy.code) throw new Error(legacy.error);
  console.log(legacy.output.trim());
  await run(["docker", "kill", "--signal=KILL", owner]);
  const replacement = await run([
    ...args,
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts';acquirePgliteLock('/owned/database')(); console.log('Killed foreign container owner reclaimed safely');`,
  ]);
  if (replacement.code) throw new Error(replacement.error);
  console.log(replacement.output.trim());
} finally {
  await run(["docker", "rm", "-f", owner]);
  await rm(root, { recursive: true, force: true });
}
