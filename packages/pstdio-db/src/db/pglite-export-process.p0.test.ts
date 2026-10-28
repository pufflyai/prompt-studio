import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runExportWorker } from "./pglite-export-process";

test("export children must confirm completion and propagate their failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-worker-result-"));
  const entry = join(root, "worker.ts");
  try {
    await Bun.write(entry, 'console.error("failed export"); process.exit(7);');
    await expect(runExportWorker({ entry, args: [] })).rejects.toThrow("failed export");
    await Bun.write(entry, "console.log(JSON.stringify({completed:false}));");
    await expect(runExportWorker({ entry, args: [] })).rejects.toThrow("did not confirm completion");
    await Bun.write(entry, "console.log(JSON.stringify({completed:true}));");
    await expect(runExportWorker({ entry, args: [] })).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelling an export terminates its child before returning the cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-worker-cancel-"));
  const entry = join(root, "worker.ts");
  const ready = join(root, "ready");
  const controller = new AbortController();
  await Bun.write(
    entry,
    `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`,
  );
  const running = runExportWorker({ entry, args: [], signal: controller.signal });
  try {
    while (!(await Bun.file(ready).exists())) await Bun.sleep(5);
    const pid = Number(await Bun.file(ready).text());
    controller.abort(new Error("superseded export"));
    await expect(running).rejects.toThrow("superseded export");
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    controller.abort();
    await running.catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
