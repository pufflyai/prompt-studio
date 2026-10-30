import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "../../../..");
const defaults = JSON.parse(process.env.PSTDIO_DEFAULT_EXTENSIONS!);
const lab = defaults.defaultExtensions.find((entry: { installName: string }) => entry.installName === "extension-lab");
// Browser regressions exercise current public APIs. The separate published-extension check owns release compatibility.
if (!process.env.E2E_EXTENSION_LAB_SOURCE) throw new Error("Start UI tests with the test:ui launcher.");
lab.source = process.env.E2E_EXTENSION_LAB_SOURCE;
lab.skipInstall = true;

const child = Bun.spawn(
  [process.execPath, "--conditions=source", "src/index.ts", "serve", "--foreground", ...process.argv.slice(2)],
  {
    cwd: join(repoRoot, "packages/pstdio"),
    env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(defaults) },
    stdout: "inherit",
    stderr: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
process.exitCode = await child.exited;
