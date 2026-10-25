import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
    retire: async (active) => {
      interrupt("retire-started");
      await rename(active, join(dirname(active), "retired"));
    },
    prepare: async ({ target }) => {
      await mkdir(target);
      await writeFile(join(target, "record"), "first value");
      interrupt("candidate-created");
    },
  });
} finally {
  release();
}
