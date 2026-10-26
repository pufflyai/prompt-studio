import { existsSync, linkSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { readdir, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const removeParallel = async (root: string, levels: number) => {
  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory() && levels > 0) await removeParallel(path, levels - 1);
      else await rm(path, { recursive: true, force: true });
    }),
  );
  await rmdir(root);
};
const removeWith = async (command: string[]) => {
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
  const [exit, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exit !== 0) throw new Error(`${command[0]} removal failed (${exit}): ${stderr}`);
};
const methods = {
  bun: (root: string) => rm(root, { recursive: true, force: true }),
  parallel: (root: string) => removeParallel(root, 3),
  node: (root: string) =>
    removeWith([
      "node",
      "--input-type=module",
      "--eval",
      'import {rm} from "node:fs/promises"; await rm(process.argv[1], {recursive:true,force:true});',
      root,
    ]),
  native: (root: string) => removeWith(["cmd.exe", "/d", "/c", "rmdir", "/s", "/q", root]),
};
const results: unknown[] = [];
const content = Buffer.alloc(8192, 1);
for (const [method, remove] of Object.entries(methods)) {
  const root = mkdtempSync(join(tmpdir(), `pstdio-removal-${method}-`));
  const creating = performance.now();
  try {
    for (let packageId = 0; packageId < 300; packageId++) {
      const cached = join(root, "cache", "extension-bun-install", `package-${packageId}`);
      const installed = join(root, "extensions", "planner", "node_modules", `package-${packageId}`);
      mkdirSync(cached, { recursive: true });
      mkdirSync(installed, { recursive: true });
      for (let fileId = 0; fileId < 50; fileId++) {
        const path = join(cached, `file-${fileId}`);
        writeFileSync(path, content);
        linkSync(path, join(installed, `file-${fileId}`));
      }
      const runtime = join(root, "cache", "extension-runtime", `runtime-${packageId}`);
      mkdirSync(runtime, { recursive: true });
      symlinkSync(installed, join(runtime, "package"), "junction");
    }
    const creationMs = performance.now() - creating;
    const removing = performance.now();
    await remove(root);
    const result = {
      method,
      creationMs,
      removalMs: performance.now() - removing,
      files: 30000,
      packagePairs: 300,
      junctions: 300,
      removed: !existsSync(root),
    };
    if (!result.removed) throw new Error(`Removal retained ${root}`);
    console.log(JSON.stringify(result));
    results.push(result);
  } finally {
    if (existsSync(root)) await rm(root, { recursive: true, force: true });
  }
}
const output = join(
  import.meta.dirname,
  "../../../../.pstdio/extension-storage/pstdio.pstdio-artifacts/native-removal-profile/results.json",
);
await Bun.write(output, JSON.stringify(results, null, 2));
