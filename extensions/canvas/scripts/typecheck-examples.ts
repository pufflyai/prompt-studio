import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { repoRoot, sourceFiles } from "./story-catalog";

// Authoring types stay in the repository; published extension checks compile runtime sources only.
const owners = new Set<string>();
for (const source of (await sourceFiles()).filter((source) => source.endsWith(".canvas.tsx"))) {
  let directory = dirname(resolve(repoRoot, source));
  while (directory !== repoRoot && !existsSync(resolve(directory, "package.json"))) directory = dirname(directory);
  if (directory !== repoRoot) owners.add(directory);
}
for (const owner of [...owners].sort()) {
  const name = owner.slice(repoRoot.length + 1);
  const config = name === "packages/ui" ? "tsconfig.examples.json" : "tsconfig.canvas.json";
  if (!existsSync(resolve(owner, config))) throw new Error(`Missing Canvas type configuration: ${name}/${config}`);
  console.log(`Check Canvas examples: ${name}`);
  const check = Bun.spawn(["bun", "check", "-p", config], { cwd: owner, stdout: "inherit", stderr: "inherit" });
  if (await check.exited) process.exit(1);
}
