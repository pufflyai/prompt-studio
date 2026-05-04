import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileWatermarkStore } from "./file-watermark-store";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-scheduler-fws-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("createFileWatermarkStore", () => {
  test("load returns empty map when file does not exist", async () => {
    const store = createFileWatermarkStore(join(createTempDir(), "missing.json"));
    const loaded = await store.load();
    expect(loaded.size).toBe(0);
  });

  test("save writes JSON and load reads it back", async () => {
    const path = join(createTempDir(), "watermarks.json");
    const store = createFileWatermarkStore(path);

    await store.save(
      new Map([
        ["b", 2],
        ["a", 1],
      ]),
    );
    const raw = await Bun.file(path).text();
    expect(raw).toBe(`{\n  "a": 1,\n  "b": 2\n}\n`);

    const loaded = await store.load();
    expect(loaded.get("a")).toBe(1);
    expect(loaded.get("b")).toBe(2);
  });

  test("save creates parent directories if missing", async () => {
    const path = join(createTempDir(), "nested", "subdir", "watermarks.json");
    const store = createFileWatermarkStore(path);

    await store.save(new Map([["x", 5]]));
    const raw = await Bun.file(path).text();
    expect(JSON.parse(raw)).toEqual({ x: 5 });
  });

  test("load gracefully handles invalid JSON", async () => {
    const path = join(createTempDir(), "bad.json");
    writeFileSync(path, "not json", "utf8");
    const store = createFileWatermarkStore(path);
    const loaded = await store.load();
    expect(loaded.size).toBe(0);
  });
});
