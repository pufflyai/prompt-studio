import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Preserve every package's built publication directory, including executable modes.
// Source assets remain owned by the immutable version commit checked out by consumers.
const { workspaces } = JSON.parse(readFileSync("package.json", "utf8")) as { workspaces: string[] };
const paths = new Set<string>(["packages/pstdio/dist"]);
for (const workspace of workspaces) {
  const roots = workspace.endsWith("/*")
    ? readdirSync(workspace.slice(0, -2)).map((entry) => join(workspace.slice(0, -2), entry))
    : [workspace];
  for (const root of roots) {
    if (!existsSync(join(root, "package.json"))) continue;
    for (const output of [".publish", "dist", "dist-monaco"]) {
      const path = join(root, output);
      if (existsSync(path)) paths.add(path);
    }
  }
}
const result = Bun.spawn(["tar", "-czf", "release-build.tar.gz", ...[...paths].sort()], {
  stdout: "inherit",
  stderr: "inherit",
});
if (await result.exited) throw new Error("Could not archive release outputs");

const identity = await Bun.spawn(["bun", "scripts/ci/production-payload.ts", "record", "release-build.tar.gz"], {
  stdout: "inherit",
  stderr: "inherit",
}).exited;
if (identity) throw new Error("Could not record release payload digest");
