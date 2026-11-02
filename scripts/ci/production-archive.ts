import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Preserve every package's built publication directory, including executable modes.
// Source assets remain owned by the immutable version commit checked out by consumers.
export const productionArchivePaths = (workspaceRoot = process.cwd()) => {
  const { workspaces } = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8")) as {
    workspaces: string[];
  };
  const paths = new Set<string>(["packages/pstdio/dist"]);
  for (const workspace of workspaces) {
    const roots = workspace.endsWith("/*")
      ? readdirSync(join(workspaceRoot, workspace.slice(0, -2))).map((entry) => join(workspace.slice(0, -2), entry))
      : [workspace];
    for (const root of roots) {
      const manifest = join(workspaceRoot, root, "package.json");
      if (!existsSync(manifest)) continue;
      const { nx } = JSON.parse(readFileSync(manifest, "utf8")) as {
        nx?: { targets?: { build?: { outputs?: string[] } } };
      };
      const outputs = [
        ...[".publish", "dist", "dist-monaco"].map((output) => join(root, output)),
        ...(nx?.targets?.build?.outputs ?? []).map((output) =>
          output.replaceAll("{projectRoot}", root).replaceAll("{workspaceRoot}", "."),
        ),
      ];
      for (const output of outputs) {
        const path = output.replaceAll("\\", "/");
        if (existsSync(join(workspaceRoot, path))) paths.add(path);
      }
    }
  }
  return [...paths].sort();
};

if (import.meta.main) {
  const result = Bun.spawn(["tar", "-czf", "release-build.tar.gz", ...productionArchivePaths()], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await result.exited) throw new Error("Could not archive release outputs");

  const identity = await Bun.spawn(["bun", "scripts/ci/production-payload.ts", "record", "release-build.tar.gz"], {
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
  if (identity) throw new Error("Could not record release payload digest");
}
