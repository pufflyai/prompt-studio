import { join } from "node:path";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";

const repoRoot = join(import.meta.dirname, "../../../..");
const defaults = JSON.parse(process.env.PSTDIO_DEFAULT_EXTENSIONS!);
const lab = defaults.defaultExtensions.find((entry: { installName: string }) => entry.installName === "extension-lab");
// Browser regressions exercise current public APIs. The separate published-extension check owns release compatibility.
lab.source = await preparePackagedExtensionSource(join(process.env.PSTDIO_HOME!, "fixtures", "lab"), lab.source);
delete lab.skipInstall;

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
