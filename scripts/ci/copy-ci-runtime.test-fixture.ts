import { copyFile, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const copyCiRuntime = async (root: string) => {
  await cp(import.meta.dirname, join(root, "scripts/ci"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  // Priority planning reads the shared suite registry, including in these isolated checkouts.
  const benchmarkPackage = join(import.meta.dirname, "../../packages/benchmarks");
  const installed = join(root, "node_modules/pstdio-benchmarks");
  await mkdir(installed, { recursive: true });
  await copyFile(join(benchmarkPackage, "package.json"), join(installed, "package.json"));
  await cp(join(benchmarkPackage, "src"), join(installed, "src"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
};
