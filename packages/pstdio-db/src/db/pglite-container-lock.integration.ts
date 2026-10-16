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
  "-v",
  `${repo}:/work`,
  "-v",
  `${root}:/owned`,
  "-w",
  "/work",
  "oven/bun:1.4.2",
  "bun",
  "-e",
];
const run = async (command: string[]) => {
  const p = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(p.stdout).text();
  const error = await new Response(p.stderr).text();
  return { code: await p.exited, output, error };
};
try {
  const first = await run([
    ...args.slice(0, 2),
    "-d",
    "--name",
    owner,
    ...args.slice(2),
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts'; acquirePgliteLock('/owned/database'); await Bun.write('/owned/ready','ready');setInterval(()=>{},1000)`,
  ]);
  if (first.code) throw new Error(first.error);
  while (!(await Bun.file(join(root, "ready")).exists())) await Bun.sleep(20);
  const contender = await run([
    ...args,
    `import {acquirePgliteLock} from './packages/pstdio-db/src/db/pglite-lock.ts';try {acquirePgliteLock('/owned/database'); process.exit(3)}catch(e){if(!e.message.includes('refusing'))throw e; console.log('Live foreign container owner denied');}`,
  ]);
  if (contender.code) throw new Error(contender.error);
  console.log(contender.output.trim());
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
