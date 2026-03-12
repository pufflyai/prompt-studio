import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHandler } from "./write";

const tmpBase = join(import.meta.dirname, "__test-tmp-write__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
  mkdirSync(join(tmpBase, ".pstdio"), { recursive: true });
  writeFileSync(join(tmpBase, ".pstdio", "config.json"), '{"project_id":"proj-1"}');
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("templates write", () => {
  test("writes docs template without requiring navigation.json", async () => {
    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () => ({
        id: "tpl-1",
        name: "prd",
        template_type: "document",
        is_default: true,
        content: "# {{TICKET_TITLE}}",
      }),
    });

    await handler({ name: "prd", target: "docs/prd/new-feature", _: [], $0: "" } as never);

    const docPath = join(tmpBase, ".pstdio", "docs", "prd", "new-feature.md");
    expect(existsSync(docPath)).toBe(true);
    expect(readFileSync(docPath, "utf8")).toContain("# prd");
    expect(existsSync(join(tmpBase, ".pstdio", "docs", "navigation.json"))).toBe(false);
  });
});
