import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Canvas files are type-checked by the package that owns them, with its canvas configuration.
const repoRoot = resolve(import.meta.dir, "../../../..");
const listing = Bun.spawnSync(["git", "ls-files", "--cached", "--others", "--exclude-standard", "*.canvas.tsx"], {
  cwd: repoRoot,
});
if (!listing.success) throw new Error(`Could not list canvas files: ${listing.stderr.toString()}`);
const sources = listing.stdout.toString().split("\n").filter(Boolean);
const owners = new Set<string>();
for (const source of sources) {
  let directory = dirname(resolve(repoRoot, source));
  while (directory !== repoRoot && !existsSync(resolve(directory, "package.json"))) directory = dirname(directory);
  if (directory !== repoRoot) owners.add(directory);
}
for (const owner of [...owners].sort()) {
  const name = owner.slice(repoRoot.length + 1);
  const config = name === "packages/ui" ? "tsconfig.examples.json" : "tsconfig.canvas.json";
  if (!existsSync(resolve(owner, config))) throw new Error(`Missing Canvas type configuration: ${name}/${config}`);
  console.log(`Check canvas files: ${name}`);
  const check = Bun.spawn(["bun", "check", "-p", config], { cwd: owner, stdout: "inherit", stderr: "inherit" });
  if (await check.exited) process.exit(1);
}
