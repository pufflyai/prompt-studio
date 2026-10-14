import { resolve } from "node:path";
import { sharedStorybooks } from "./storybook-config";

const root = resolve(import.meta.dirname, "../../../..");
const started = performance.now();
for (const { packageName } of sharedStorybooks) {
  const packageStarted = performance.now();
  const child = Bun.spawn(["bun", "run", "--cwd", `packages/${packageName}`, "build-storybook"], {
    cwd: root,
    env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
  console.log(`[storybook build] ${packageName}: ${((performance.now() - packageStarted) / 1000).toFixed(1)}s`);
}
console.log(`[storybook build] all packages: ${((performance.now() - started) / 1000).toFixed(1)}s`);
