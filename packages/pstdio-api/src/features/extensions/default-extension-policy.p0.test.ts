import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installDefaultExtensions } from "./default-extensions";
import { resolveDefaultExtensionsConfig } from "./default-extensions-config";
import { installed, writeExtension } from "./default-extensions-test-fixtures";

test("explicit local defaults without removals do not depend on unrelated catalog availability", async () => {
  const home = await mkdtemp(join(tmpdir(), "default-policy-"));
  const entries = [{ source: join(home, "local-tool"), installName: "local-tool" }];
  try {
    expect(
      await resolveDefaultExtensionsConfig({
        PSTDIO_HOME: home,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(entries),
        PSTDIO_EXTENSION_CATALOG: join(home, "unavailable-catalog.json"),
      }),
    ).toEqual({ defaultExtensions: entries });
    writeExtension(entries[0]!.source, "local-tool", "user");
    const calls: string[] = [];
    const results = await installDefaultExtensions({
      env: {
        PSTDIO_HOME: home,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(entries),
        PSTDIO_EXTENSION_CATALOG: join(home, "unavailable-catalog.json"),
      },
      installExtensionSource: async (input) => {
        calls.push(input.source);
        return installed;
      },
    });
    expect(calls).toEqual([entries[0]!.source]);
    expect(results).toEqual([installed]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
