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
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "prd",
          template_type: "document",
          is_default: true,
          content: "# {{TICKET_TITLE}}",
        }) as never,
    });

    await handler({ name: "prd", target: "docs/prd/new-feature", _: [], $0: "" } as never);

    const docPath = join(tmpBase, ".pstdio", "docs", "prd", "new-feature.md");
    expect(existsSync(docPath)).toBe(true);
    expect(readFileSync(docPath, "utf8")).toContain("# prd");
    expect(existsSync(join(tmpBase, ".pstdio", "docs", "navigation.json"))).toBe(false);
  });

  test("writes ticket template to shorthand ticket directory", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1"), { recursive: true });

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "ticket",
          template_type: "ticket",
          is_default: true,
          content: "# {{TICKET_ID}}",
        }) as never,
    });

    await handler({ name: "ticket", target: "PS-1", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# PS-1");
  });

  test("throws when only a legacy ticket directory exists", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-2_old-title"), { recursive: true });

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "ticket",
          template_type: "ticket",
          is_default: true,
          content: "# Updated",
        }) as never,
    });

    await expect(handler({ name: "ticket", target: "PS-2", _: [], $0: "" } as never)).rejects.toThrow(
      "Ticket not found: PS-2",
    );
  });

  test("preserves existing ticket title when writing template", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-4");
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# My important feature\n\nSome content");

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "ticket",
          template_type: "ticket",
          is_default: true,
          content: "# {{TICKET_TITLE}}\n\n## Details",
        }) as never,
    });

    await handler({ name: "ticket", target: "PS-4", _: [], $0: "" } as never);

    const result = readFileSync(join(ticketDir, "ticket.md"), "utf8");
    expect(result).toBe("# My important feature\n\n## Details");
  });

  test("falls back to shorthand when no existing ticket content", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-5"), { recursive: true });

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "ticket",
          template_type: "ticket",
          is_default: true,
          content: "# {{TICKET_TITLE}}",
        }) as never,
    });

    await handler({ name: "ticket", target: "PS-5", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, ".pstdio", "tickets", "PS-5", "ticket.md"), "utf8")).toBe("# PS-5");
  });

  test("writes to exact shorthand directory even when legacy directories are present", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-3"), { recursive: true });
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-3_old-title"), { recursive: true });

    const handler = createHandler({
      cwd: () => tmpBase,
      findGitRoot: () => tmpBase,
      readConfig: () => ({ project_id: "proj-1" }),
      getTemplate: async () =>
        ({
          id: "tpl-1",
          name: "ticket",
          template_type: "ticket",
          is_default: true,
          content: "# Updated",
        }) as never,
    });

    await handler({ name: "ticket", target: "PS-3", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, ".pstdio", "tickets", "PS-3", "ticket.md"), "utf8")).toBe("# Updated");
    expect(existsSync(join(tmpBase, ".pstdio", "tickets", "PS-3_old-title"))).toBe(true);
  });
});
