import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuredContainer } from "./storage-scale-container";

test("an explicit container boundary cannot silently fall back to a different native fixture", () => {
  const root = mkdtempSync(join(tmpdir(), "scale-container-"));
  const previous = process.env.PSTDIO_SCALE_CONTAINER_CONFIG;
  try {
    const path = join(root, "runtime.json");
    const home = join(root, "home");
    writeFileSync(path, JSON.stringify({ home, containerId: "diagnostic", baseUrl: "http://127.0.0.1:19841" }));
    process.env.PSTDIO_SCALE_CONTAINER_CONFIG = path;
    expect(configuredContainer(home)?.containerId).toBe("diagnostic");
    expect(() => configuredContainer(join(root, "other"))).toThrow("fixture home differ");
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_SCALE_CONTAINER_CONFIG;
    else process.env.PSTDIO_SCALE_CONTAINER_CONFIG = previous;
    rmSync(root, { recursive: true });
  }
});
