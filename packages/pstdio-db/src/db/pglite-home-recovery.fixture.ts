import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { preparePgliteHome } from "./pglite-home-recovery";
import { acquirePgliteLock } from "./pglite-lock";

const [activePath, interruption] = process.argv.slice(2);
if (!activePath) throw new Error("Expected an isolated active home");
const interrupt = (phase: string) => {
  if (phase === interruption) process.exit(73);
};
const release = acquirePgliteLock(activePath);
try {
  await preparePgliteHome({
    activePath,
    onPhase: interrupt,
    prepare: async ({ source, target }) => {
      await mkdir(target);
      await writeFile(join(target, "record"), source ? await readFile(join(source, "record")) : "first value");
      interrupt("candidate-created");
    },
  });
} finally {
  release();
}
