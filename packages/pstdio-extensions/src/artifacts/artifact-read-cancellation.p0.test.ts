import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileMount } from "./artifact-mount";

test("aborted mount reads stop while writes keep their independent lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "mount-cancellation-"));
  const controller = new AbortController();
  try {
    const mount = createFileMount(root, controller.signal);
    await mount.writeText("document.md", "saved");
    controller.abort();
    await expect(mount.readText("document.md")).rejects.toThrow();
    await expect(mount.list()).rejects.toThrow();
    await mount.writeText("document.md", "still saved");
    expect(await createFileMount(root).readText("document.md")).toBe("still saved");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
