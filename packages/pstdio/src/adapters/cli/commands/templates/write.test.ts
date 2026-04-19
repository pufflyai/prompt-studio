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

const makeDeps = (content: string) => ({
  cwd: () => tmpBase,
  findGitRoot: () => tmpBase,
  readConfig: () => ({ project_id: "proj-1" }),
  getTemplate: async () =>
    ({
      id: "tpl-1",
      name: "tpl",
      template_type: "document",
      is_default: true,
      content,
    }) as never,
});

describe("templates write --ticket", () => {
  test("writes ticket template to shorthand ticket directory", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-1"), { recursive: true });

    const handler = createHandler(makeDeps("# {{TICKET_ID}}"));

    await handler({ name: "ticket", ticket: "PS-1", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, ".pstdio", "tickets", "PS-1", "ticket.md"), "utf8")).toBe("# PS-1");
  });

  test("throws when ticket directory does not exist", async () => {
    const handler = createHandler(makeDeps("# Updated"));

    await expect(handler({ name: "ticket", ticket: "PS-2", _: [], $0: "" } as never)).rejects.toThrow(
      "Ticket not found: PS-2",
    );
  });

  test("preserves existing ticket title when writing template", async () => {
    const ticketDir = join(tmpBase, ".pstdio", "tickets", "PS-4");
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, "ticket.md"), "# My important feature\n\nSome content");

    const handler = createHandler(makeDeps("# {{TICKET_TITLE}}\n\n## Details"));

    await handler({ name: "ticket", ticket: "PS-4", _: [], $0: "" } as never);

    expect(readFileSync(join(ticketDir, "ticket.md"), "utf8")).toBe("# My important feature\n\n## Details");
  });

  test("falls back to shorthand when no existing ticket content", async () => {
    mkdirSync(join(tmpBase, ".pstdio", "tickets", "PS-5"), { recursive: true });

    const handler = createHandler(makeDeps("# {{TICKET_TITLE}}"));

    await handler({ name: "ticket", ticket: "PS-5", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, ".pstdio", "tickets", "PS-5", "ticket.md"), "utf8")).toBe("# PS-5");
  });
});

describe("templates write --target", () => {
  test("writes template to path relative to cwd, overwriting existing file", async () => {
    const docsDir = join(tmpBase, "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "notes.md"), "previous content");

    const handler = createHandler(makeDeps("# Replaced"));

    await handler({ name: "tpl", target: "docs/notes.md", _: [], $0: "" } as never);

    expect(readFileSync(join(docsDir, "notes.md"), "utf8")).toBe("# Replaced");
  });

  test("creates parent directories for nested target", async () => {
    const handler = createHandler(makeDeps("hello"));

    await handler({ name: "tpl", target: "a/b/c/new.md", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, "a", "b", "c", "new.md"), "utf8")).toBe("hello");
  });

  test("writes to non-md target", async () => {
    const handler = createHandler(makeDeps("raw text"));

    await handler({ name: "tpl", target: "out/plain.txt", _: [], $0: "" } as never);

    expect(readFileSync(join(tmpBase, "out", "plain.txt"), "utf8")).toBe("raw text");
  });

  test("fills placeholders from --var entries", async () => {
    const handler = createHandler(makeDeps("hi {{NAME}} / {{ROLE}}"));

    await handler({
      name: "tpl",
      target: "greeting.md",
      var: ["NAME=Ada", "ROLE=admin"],
      _: [],
      $0: "",
    } as never);

    expect(readFileSync(join(tmpBase, "greeting.md"), "utf8")).toBe("hi Ada / admin");
  });

  test("rejects invalid --var format", async () => {
    const handler = createHandler(makeDeps("x"));

    await expect(handler({ name: "tpl", target: "x.md", var: ["NO_EQUALS"], _: [], $0: "" } as never)).rejects.toThrow(
      /Invalid --var/,
    );
  });

  test("does not perform ticket title preservation", async () => {
    const filePath = join(tmpBase, "existing.md");
    writeFileSync(filePath, "# Old title\n\nbody");

    const handler = createHandler(makeDeps("# {{TICKET_TITLE}}"));

    await handler({ name: "tpl", target: "existing.md", _: [], $0: "" } as never);

    expect(readFileSync(filePath, "utf8")).toBe("# ");
  });

  test("absolute target path is written as-is", async () => {
    const absDir = join(tmpBase, "abs");
    mkdirSync(absDir, { recursive: true });
    const absPath = join(absDir, "file.md");

    const handler = createHandler(makeDeps("absolute"));

    await handler({ name: "tpl", target: absPath, _: [], $0: "" } as never);

    expect(readFileSync(absPath, "utf8")).toBe("absolute");
    expect(existsSync(absPath)).toBe(true);
  });
});

describe("templates write argument validation", () => {
  test("throws when neither --target nor --ticket is provided", async () => {
    const handler = createHandler(makeDeps("x"));

    await expect(handler({ name: "tpl", _: [], $0: "" } as never)).rejects.toThrow(/one of --target or --ticket/);
  });

  test("throws when both --target and --ticket are provided", async () => {
    const handler = createHandler(makeDeps("x"));

    await expect(handler({ name: "tpl", target: "x.md", ticket: "PS-1", _: [], $0: "" } as never)).rejects.toThrow(
      /mutually exclusive/,
    );
  });
});
