import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeBuildCaches } from "./merge-build-cache";

test("overlapping task archives retain one complete producer's bytes and replace stale downloads", () => {
  const root = mkdtempSync(join(tmpdir(), "ci-cache-import-"));
  const sources = join(root, "artifacts");
  const destination = join(root, "cache");
  try {
    for (const directory of [destination, join(sources, "a"), join(sources, "b")])
      mkdirSync(directory, { recursive: true });
    writeFileSync(join(destination, "123.tar.gz"), "old incomplete download");
    writeFileSync(join(sources, "a", "123.tar.gz"), "complete first producer");
    writeFileSync(join(sources, "b", "123.tar.gz"), "a different complete archive for the same task");
    writeFileSync(join(sources, "b", "456.tar.gz"), "another task");
    mergeBuildCaches(sources, destination);
    expect(readFileSync(join(destination, "123.tar.gz"), "utf8")).toBe("complete first producer");
    expect(readFileSync(join(destination, "456.tar.gz"), "utf8")).toBe("another task");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
