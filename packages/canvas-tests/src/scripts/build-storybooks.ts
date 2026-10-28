import { resolve } from "node:path";
import { sharedStorybooks } from "./storybook-config";

const root = resolve(import.meta.dirname, "../../../..");
const started = performance.now();
const failed: string[] = [];
for (const { packageName } of sharedStorybooks) {
  const packageStarted = performance.now();
  const child = Bun.spawn(["bun", "run", "--cwd", `packages/${packageName}`, "build:preview-tests"], {
    cwd: root,
    env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    failed.push(packageName);
    if ((process.env.CI_PRIORITY ?? "P1") === "P1") break;
  }
  console.log(`[storybook build] ${packageName}: ${((performance.now() - packageStarted) / 1000).toFixed(1)}s`);
}
console.log(`[storybook build] all packages: ${((performance.now() - started) / 1000).toFixed(1)}s`);

if (failed.length > 0) {
  console.error(`Storybook builds failed: ${failed.join(", ")}`);
  process.exitCode = 1;
}
