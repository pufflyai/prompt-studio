import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("packaged runtime stays available after an offline icon lookup", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-offline-icons-"));
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    host = await startPackagedServe(root);
    const headers = runtimeAuthorization(host.descriptor);
    const url = `https://pstdio-offline-${crypto.randomUUID()}.invalid`;
    const icon = await fetch(`${host.baseUrl}/v1/link-icons?url=${encodeURIComponent(url)}`, { headers });
    expect(icon.status).toBe(404);
    await icon.body?.cancel();
    const ready = await fetch(`${host.baseUrl}/runtime/ready`, { headers });
    expect(ready.ok).toBe(true);
    expect((await ready.json()).instanceId).toBe(host.descriptor.instanceId);
  } finally {
    if (host) await stopProcess(host.child);
    rmSync(root, { recursive: true, force: true });
  }
});
