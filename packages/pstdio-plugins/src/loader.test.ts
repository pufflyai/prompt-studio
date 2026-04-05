import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPlugins } from "./loader";

let tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-loader-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("loadPlugins", () => {
  test("returns empty array when directory does not exist", async () => {
    const result = await loadPlugins("/non/existent/path");
    expect(result).toEqual([]);
  });

  test("loads a plugin with hooks", async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "my-plugin.ts"), `export default { hooks: { postSessionStart() {} } };`);

    const result = await loadPlugins(dir);
    expect(result).toHaveLength(1);
    expect(result[0]!.identity).toBe("my-plugin");
    expect(result[0]!.definition.hooks).toBeDefined();
  });

  test("loads a plugin with actions", async () => {
    const dir = createTempDir();
    writeFileSync(
      join(dir, "my-action.ts"),
      `export default {
				actions: [{
					key: "do-thing",
					label: "Do thing",
					targetType: "ticket",
					placement: "primary",
					trigger() {},
				}],
			};`,
    );

    const result = await loadPlugins(dir);
    expect(result).toHaveLength(1);
    expect(result[0]!.definition.actions).toHaveLength(1);
  });

  test("skips files without default export", async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "helpers.ts"), `export const foo = 42;`);
    writeFileSync(join(dir, "plugin.ts"), `export default { hooks: {} };`);

    const result = await loadPlugins(dir);
    expect(result).toHaveLength(1);
    expect(result[0]!.identity).toBe("plugin");
  });

  test("fails on invalid default export shape", async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "bad.ts"), `export default "not an object";`);

    await expect(loadPlugins(dir)).rejects.toThrow("not a valid plugin");
  });

  test("fails on duplicate plugin identities", async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "plugin.ts"), `export default { hooks: {} };`);
    writeFileSync(join(dir, "plugin.js"), `export default { hooks: {} };`);

    await expect(loadPlugins(dir)).rejects.toThrow("Duplicate plugin identity");
  });

  test("derives identity from subdirectory path", async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "actions"));
    writeFileSync(join(dir, "actions", "review.ts"), `export default { hooks: {} };`);

    const result = await loadPlugins(dir);
    expect(result[0]!.identity).toBe("actions/review");
  });
});
