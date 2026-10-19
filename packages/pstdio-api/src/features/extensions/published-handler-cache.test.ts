import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { packExtension } from "./publication/package";
import { packageRevision } from "./publication/prepare";
import { loadPublishedHandlers } from "./published-handler-cache";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("concurrent and repeated handler loads reuse one immutable module until host shutdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "handler-cache-"));
  const app = await createTestApp();
  try {
    const source = createTestExtensionSource({
      root,
      name: "unrelated",
      installName: "unrelated",
      displayName: "Unrelated",
    });
    await writeFile(join(source, "extension.ts"), "export default {conflictHandlers: {merge: () => null}};");
    const bytes = await packExtension(source);
    const input = { bytes, extensionId: "test.unrelated", revision: await packageRevision(bytes) };
    const [first, concurrent] = await Promise.all([
      loadPublishedHandlers(app.deps.extensionStorageService, input),
      loadPublishedHandlers(app.deps.extensionStorageService, input),
    ]);
    expect(concurrent.loaded.definition).toBe(first.loaded.definition);
    expect((await loadPublishedHandlers(app.deps.extensionStorageService, input)).path).toBe(first.path);
    expect(await Bun.file(join(first.path, "extension.ts")).exists()).toBe(true);
    await app.close();
    expect(await Bun.file(join(first.path, "extension.ts")).exists()).toBe(false);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
