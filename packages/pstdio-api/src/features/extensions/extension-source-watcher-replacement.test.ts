import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

test("allows source replacement while watching nested directories and observes the replacement", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-watcher-replacement-"));
  const source = join(root, "source");
  const writeSource = () => {
    mkdirSync(join(source, "nested"), { recursive: true });
    writeFileSync(join(source, "nested", "entry.ts"), "export default 1;");
  };
  writeSource();
  let changes = 0;
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "source", source_path: source }],
    onSourceChanged: async () => {
      changes += 1;
    },
  });
  try {
    renameSync(source, join(root, "previous"));
    writeSource();
    await watcher.refresh();
    const beforeEdit = changes;
    writeFileSync(join(source, "nested", "entry.ts"), "export default 2;");
    const deadline = Date.now() + 1000;
    while (changes === beforeEdit && Date.now() < deadline) await Bun.sleep(10);
    expect(changes).toBeGreaterThan(beforeEdit);
  } finally {
    watcher.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
