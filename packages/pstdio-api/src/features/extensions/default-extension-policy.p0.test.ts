import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDefaultExtensionsConfig } from "./default-extensions-config";

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
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
