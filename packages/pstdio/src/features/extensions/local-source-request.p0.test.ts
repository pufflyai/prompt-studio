import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostProjectSourcePath } from "./local-source-request";

test("local project sources can keep host dependency context without uploading", () => {
  const root = mkdtempSync(join(tmpdir(), "host-project-source-"));
  try {
    const project = join(root, "project");
    const source = join(project, "tools/tool");
    const outside = join(root, "outside");
    mkdirSync(source, { recursive: true });
    mkdirSync(outside);
    expect(hostProjectSourcePath(project, source)).toBe("tools/tool");
    expect(hostProjectSourcePath(project, outside)).toBeNull();
    expect(hostProjectSourcePath(join(root, "host-only"), source)).toBeNull();
    symlinkSync(outside, join(project, "escape"), "junction");
    expect(hostProjectSourcePath(project, join(project, "escape"))).toBeNull();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
