import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(join(tmpdir(), "codex-protocol-"));
try {
  const generation = Bun.spawn(["codex", "app-server", "generate-ts", "--experimental", "--out", temporary], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await generation.exited) !== 0) throw new Error("Codex protocol generation failed.");
  const pending = ["v2/Turn.ts", "v2/ThreadItem.ts", "v2/ThreadGoal.ts"];
  const visited = new Set<string>();
  const destination = join(root, "src/protocol");
  await rm(destination, { recursive: true, force: true });
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const contents = await readFile(join(temporary, path), "utf8");
    for (const match of contents.matchAll(/from "(\.[^"]+)"/g)) {
      const dependency = resolve(temporary, dirname(path), `${match[1]}.ts`);
      pending.push(dependency.slice(temporary.length + 1));
    }
    await mkdir(dirname(join(destination, path)), { recursive: true });
    await writeFile(join(destination, path), contents);
  }
  const format = Bun.spawn(["bunx", "biome", "check", "--write", destination], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await format.exited) !== 0) throw new Error("Protocol formatting failed.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
