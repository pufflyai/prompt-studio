import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapProjectRepo } from "./bootstrap-project-repo";

const tempDirs: string[] = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-project-repo-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("bootstrapProjectRepo", () => {
  test("writes project config without creating legacy plugin scaffolding", async () => {
    const repo = createTempRepo();
    const filesRoot = createTempRepo();
    const bundledPlugins = join(filesRoot, "plugins", "pstdio");
    mkdirSync(bundledPlugins, { recursive: true });
    writeFileSync(join(bundledPlugins, "ticket-actions.ts.txt"), "export default {};");

    await bootstrapProjectRepo(repo, "project-1", filesRoot);

    expect(JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8"))).toEqual({
      project_id: "project-1",
    });
    expect(existsSync(join(repo, ".pstdio", "plugins"))).toBe(false);
  });
});
