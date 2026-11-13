import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkExtensionSource } from "./extension-runtime";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("retrying an unchanged extension re-evaluates a transiently failed entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-check-retry-"));
  let attempts = 0;
  const health = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      return new Response(null, { status: ++attempts === 1 ? 503 : 200 });
    },
  });
  try {
    const source = createTestExtensionSource({ root, name: "retry", installName: "retry", displayName: "Retry" });
    await writeFile(
      join(source, "extension.ts"),
      `if (!(await fetch(${JSON.stringify(health.url.href)})).ok) throw new Error("Transient activation failure"); export default {};`,
    );
    expect((await checkExtensionSource(source, root)).check.errorCount).toBe(1);
    const retried = await checkExtensionSource(source, root);
    expect(retried.check.errorCount).toBe(0);
    expect(attempts).toBe(2);
  } finally {
    await health.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
