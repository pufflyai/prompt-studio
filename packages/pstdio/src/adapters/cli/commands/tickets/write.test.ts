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

const baseDeps = {
  cwd: () => tmpBase,
  resolveProjectId: () => ({ projectId: "proj-1", root: tmpBase }),
  getTemplate: async () => null as never,
  createTicket: async (_url: string, input: { project_id: string; title?: string }) => ({
    id: "t-1",
    shorthand: "PS-1",
    project_id: input.project_id,
    status_id: null as string | null,
    title: input.title ?? null,
    draft: true,
    created_at: "2026-03-04T00:00:00.000Z",
    updated_at: "2026-03-04T00:00:00.000Z",
  }),
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
    expect(content).toBe("# My ticket\n");
  });

  test("passes status_id when --status is provided", async () => {
    makeConfig();
    const createTicket = mock(async () => ({
      id: "t-2",
      shorthand: "PS-2",
      project_id: "proj-1",
      status_id: "s-wip",
      title: "With status",
      draft: true,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

    const handler = createHandler({ ...baseDeps, createTicket, log: mock() });

    await handler({ title: "With status", status: "wip", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status_id: "s-wip" }));
  });

  test("does not pass status_id when --status is omitted", async () => {
    makeConfig();
    const createTicket = mock(async () => ({
      id: "t-3",
      shorthand: "PS-3",
      project_id: "proj-1",
      status_id: null,
      title: "No status",
      draft: true,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

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
      createTicket: async () => ({
        id: "t-2",
        shorthand: "PS-2",
        project_id: "proj-1",
        status_id: null,
        title: "Templated",
        draft: true,
        created_at: "2026-03-04T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
      }),
      log,
    });

    await handler({
      title: "Templated",
      template: "ticket",
      input: "Some description",
      _: [],
      $0: "",
    } as never);

    const content = readTicketFile(tmpBase, "PS-2");
    expect(content).toContain("# Templated");
    expect(content).toContain("Ticket: PS-2");
    expect(content).toContain("Input: Some description");
  });

  test("throws when template not found", async () => {
    makeConfig();
    const handler = createHandler({
      ...baseDeps,
      createTicket: async () => ({
        id: "t-3",
        shorthand: "PS-3",
        project_id: "proj-1",
        status_id: null,
        title: "Fail",
        draft: true,
        created_at: "2026-03-04T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
      }),
      log: () => {},
    });

    await expect(handler({ title: "Fail", template: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Template not found: nonexistent",
    );
  });

  test("throws when tag not found", async () => {
    makeConfig();
    const handler = createHandler({
      ...baseDeps,
      resolveTagIds: async (_url, _pid, names) => {
        throw new Error(`Tag not found: ${names[0]}`);
      },
      log: () => {},
    });

    await expect(handler({ title: "Tagged", tag: ["nonexistent"], _: [], $0: "" } as never)).rejects.toThrow(
      "Tag not found: nonexistent",
    );
  });
});
