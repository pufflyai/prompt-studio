import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorkbenchPackageConsumer } from "./workbench-package-consumer";

for (const react of [false, true]) {
  test(`SDK/UI-only ${react ? "React" : "native"} consumers do not require a Workbench artifact`, () => {
    const directory = mkdtempSync(join(tmpdir(), "pstdio-selected-consumer-"));
    try {
      const entry = writeWorkbenchPackageConsumer(directory, react, ["@pstdio/sdk", "@pstdio/ui"]);
      expect(existsSync(join(directory, "workbench-consumer.ts"))).toBe(false);
      expect(entry).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test(`selecting Workbench retains its ${react ? "React" : "native"} type and runtime consumer`, () => {
    const directory = mkdtempSync(join(tmpdir(), "pstdio-selected-consumer-"));
    try {
      const entry = writeWorkbenchPackageConsumer(directory, react, [
        "@pstdio/sdk",
        "@pstdio/ui",
        "@pstdio/workbench",
        "@pstdio/canvas",
      ]);
      expect(entry).toBe("workbench-consumer.ts");
      expect(existsSync(join(directory, entry!))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
