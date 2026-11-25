import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HANDLER_MARKER, startBackendWorker } from "pstdio-extensions";

test("the CLI starts an extension backend worker without the API or a database", async () => {
  const root = await mkdtemp(join(tmpdir(), "cli-backend-worker-"));
  try {
    const home = join(root, "home");
    await mkdir(home);
    const entryPath = join(root, "extension.ts");
    await writeFile(entryPath, `export default { commands: [{ id: "ping", run: (ctx) => "pong " + ctx.projectId }] };`);
    const worker = await startBackendWorker({
      command: [process.execPath, join(import.meta.dir, "index.ts"), "extension-backend-worker"],
      env: { PATH: process.env.PATH ?? "", PSTDIO_HOME: home },
      entryPath,
    });
    try {
      const handlerId = (worker.definition as { commands: Array<{ run: Record<string, string> }> }).commands[0]!.run[
        HANDLER_MARKER
      ]!;
      const surface = { kind: "object" as const, members: { projectId: { kind: "value" as const } } };
      expect(await worker.invoke({ handlerId, context: { projectId: "p1" }, surface, args: [] })).toBe("pong p1");
      expect(await readdir(home)).toEqual([]);
    } finally {
      await worker.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
