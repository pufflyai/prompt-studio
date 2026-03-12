import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readTicketFile } from "@/features/tickets/local-ticket";
import { createHandler } from "./write";

const tmpBase = join(import.meta.dirname, "__test-tmp-write__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  mkdirSync(join(tmpBase, ".git"), { recursive: true });
  mkdirSync(join(tmpBase, ".pstdio"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

const makeConfig = () => {
  const { writeFileSync } = require("node:fs");
  writeFileSync(join(tmpBase, ".pstdio", "config.json"), '{"project_id":"proj-1"}');
};

const fakeTicket =
  (overrides: Partial<{ shorthand: string; status_id: string | null; display_title: string }> = {}) =>
  async () => ({
    id: "t-1",
    shorthand: overrides.shorthand ?? "PS-1",
    project_id: "proj-1",
    status_id: overrides.status_id ?? (null as string | null),
    display_title: overrides.display_title ?? "Ticket",
    file_id: null as string | null,
    draft: true,
    created_at: "2026-03-04T00:00:00.000Z",
    updated_at: "2026-03-04T00:00:00.000Z",
  });

const baseDeps = {
  cwd: () => tmpBase,
  resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
  getTemplate: async () => null as never,
  createTicket: fakeTicket(),
  resolveStatusId: async (_url: string, _pid: string, name: string) => {
    const statuses: Record<string, string> = { backlog: "s-backlog", wip: "s-wip" };
    const id = statuses[name];
    if (!id) throw new Error(`Status not found: ${name}`);
    return id;
  },
  resolveTagIds: async () => [] as string[],
  log: mock(),
};

describe("tickets write", () => {
  test("creates draft ticket and writes local file without template", async () => {
    makeConfig();
    const log = mock();
    const handler = createHandler({ ...baseDeps, log });

    await handler({ title: "My ticket", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Created ticket PS-1 (draft)"));
    const content = readTicketFile(tmpBase, "PS-1");
    expect(content).toContain("ticket_id:");
    expect(content).toContain("draft: true");
    expect(content).toContain('created: "2026-03-04T00:00:00.000Z"');
    expect(content).toContain("# My ticket");
  });

  test("includes status and parent_id in frontmatter when provided", async () => {
    makeConfig();
    const handler = createHandler({
      ...baseDeps,
      createTicket: fakeTicket({ shorthand: "PS-4", status_id: "s-wip" }),
      log: mock(),
    });

    await handler({ title: "With meta", status: "wip", "parent-id": "PS-1", _: [], $0: "" } as never);

    const content = readTicketFile(tmpBase, "PS-4");
    expect(content).toContain('status: "wip"');
    expect(content).toContain('parent_id: "PS-1"');
  });

  test("passes status_id when --status is provided", async () => {
    makeConfig();
    const createTicket = mock(fakeTicket({ shorthand: "PS-2", status_id: "s-wip" }));
    const handler = createHandler({ ...baseDeps, createTicket, log: mock() });

    await handler({ title: "With status", status: "wip", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status_id: "s-wip" }));
  });

  test("does not pass status_id when --status is omitted", async () => {
    makeConfig();
    const createTicket = mock(fakeTicket({ shorthand: "PS-3" }));
    const handler = createHandler({ ...baseDeps, createTicket, log: mock() });

    await handler({ title: "No status", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status_id: undefined }));
  });

  test("throws when status not found", async () => {
    makeConfig();
    const handler = createHandler({ ...baseDeps, log: mock() });
    await expect(handler({ title: "Fail", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });

  test("creates draft ticket with template", async () => {
    makeConfig();
    const log = mock();
    const handler = createHandler({
      ...baseDeps,
      getTemplate: async () => ({
        id: "tpl-1",
        name: "ticket",
        template_type: "ticket",
        is_default: true,
        content: "# {{TICKET_TITLE}}\n\nTicket: {{TICKET_ID}}\nInput: {{INPUT}}",
      }),
      createTicket: fakeTicket({ shorthand: "PS-2" }),
      log,
    });

    await handler({
      title: "Templated",
      template: "ticket",
      "user-prompt": "Some description",
      _: [],
      $0: "",
    } as never);

    const content = readTicketFile(tmpBase, "PS-2");
    expect(content).toContain('ticket_id: "PS-2"');
    expect(content).toContain('created: "2026-03-04T00:00:00.000Z"');
    expect(content).toContain("draft: true");
    expect(content).toContain("# Templated");
    expect(content).toContain("Ticket: PS-2");
    expect(content).toContain("Input: Some description");
  });

  test("preserves template frontmatter including user_prompt", async () => {
    makeConfig();
    const templateContent = [
      "---",
      'ticket_id: "{{TICKET_ID}}"',
      'user_prompt: "{{USER_PROMPT}}"',
      'created: "{{CREATED_AT}}"',
      'status: "{{STATUS}}"',
      'priority: "[P1|P2|P3]"',
      "---",
      "",
      "# {{TICKET_TITLE}}",
    ].join("\n");
    const handler = createHandler({
      ...baseDeps,
      getTemplate: async () => ({
        id: "tpl-1",
        name: "ticket",
        template_type: "ticket",
        is_default: true,
        content: templateContent,
      }),
      createTicket: fakeTicket({ shorthand: "PS-5" }),
      log: mock(),
    });

    await handler({
      title: "With template FM",
      template: "ticket",
      "user-prompt": "Build the thing",
      status: "wip",
      _: [],
      $0: "",
    } as never);

    const content = readTicketFile(tmpBase, "PS-5");
    expect(content).toContain('user_prompt: "Build the thing"');
    expect(content).toContain('status: "wip"');
    expect(content).toContain('priority: "[P1|P2|P3]"');
    expect(content).toContain("# With template FM");
  });

  test("includes user_prompt in frontmatter for non-template tickets", async () => {
    makeConfig();
    const handler = createHandler({ ...baseDeps, createTicket: fakeTicket({ shorthand: "PS-6" }), log: mock() });

    await handler({ title: "With prompt", "user-prompt": "Fix the login flow", _: [], $0: "" } as never);

    const content = readTicketFile(tmpBase, "PS-6");
    expect(content).toContain('user_prompt: "Fix the login flow"');
    expect(content).toContain("# With prompt");
  });

  test("sends markdown heading as API content", async () => {
    makeConfig();
    const createTicket = mock(fakeTicket({ shorthand: "PS-7" }));
    const handler = createHandler({ ...baseDeps, createTicket, log: mock() });

    await handler({ title: "API content", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: "# API content\n" }),
    );
  });

  test("throws when template not found", async () => {
    makeConfig();
    const handler = createHandler({ ...baseDeps, createTicket: fakeTicket({ shorthand: "PS-3" }), log: () => {} });
    await expect(handler({ title: "Fail", template: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Template not found: nonexistent",
    );
  });

  test("throws when tag not found", async () => {
    makeConfig();
    const handler = createHandler({
      ...baseDeps,
      resolveTagIds: async (_url: string, _pid: string, names: string[]) => {
        throw new Error(`Tag not found: ${names[0]}`);
      },
      log: () => {},
    });
    await expect(handler({ title: "Tagged", tag: ["nonexistent"], _: [], $0: "" } as never)).rejects.toThrow(
      "Tag not found: nonexistent",
    );
  });
});
