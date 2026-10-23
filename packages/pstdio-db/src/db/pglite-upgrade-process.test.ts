import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpgradeWorker } from "./pglite-upgrade-process";

test("upgrade children must confirm completion and propagate their failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-worker-result-"));
  const entry = join(root, "worker.ts");
  try {
    await Bun.write(entry, 'console.error("failed import"); process.exit(7);');
    await expect(runUpgradeWorker({ entry, args: ["import"] })).rejects.toThrow("failed import");
    await Bun.write(entry, 'console.log(JSON.stringify({phase:"import", completed:false}));');
    await expect(runUpgradeWorker({ entry, args: ["import"] })).rejects.toThrow("did not confirm completion");
    await Bun.write(entry, 'console.log(JSON.stringify({phase:"import", completed:true}));');
    await expect(runUpgradeWorker({ entry, args: ["import"] })).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cancelling an upgrade terminates its child before returning the cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-worker-cancel-"));
  const entry = join(root, "worker.ts");
  const ready = join(root, "ready");
  const controller = new AbortController();
  await Bun.write(
    entry,
    `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`,
  );
  const running = runUpgradeWorker({ entry, args: ["export"], signal: controller.signal });
  try {
    while (!(await Bun.file(ready).exists())) await Bun.sleep(5);
    const pid = Number(await Bun.file(ready).text());
    controller.abort(new Error("superseded upgrade"));
    await expect(running).rejects.toThrow("superseded upgrade");
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    controller.abort();
    await running.catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
