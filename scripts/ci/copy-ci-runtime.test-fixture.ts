import { copyFile, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const copyCiRuntime = async (root: string) => {
  await cp(import.meta.dirname, join(root, "scripts/ci"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  // Priority planning reads the shared suite registry, including in these isolated checkouts.
  const benchmarkPackage = join(import.meta.dirname, "../../packages/benchmarks");
  const source = join(root, "packages/benchmarks");
  await mkdir(source, { recursive: true });
  await copyFile(join(benchmarkPackage, "package.json"), join(source, "package.json"));
  await cp(join(benchmarkPackage, "src"), join(source, "src"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
};
