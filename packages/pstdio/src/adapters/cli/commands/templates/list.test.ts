import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

const makeTemplate = (input: { name: string; readOnly?: boolean }) =>
  ({
    id: input.name,
    project_id: "proj-1",
    name: input.name,
    template_type: "ticket",
    file_id: `${input.name}-file`,
    is_default: false,
    read_only: input.readOnly,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  }) as never;

describe("templates list", () => {
  test("passes type filters and prints registry source", async () => {
    const listTemplates = mock(async () => [
      makeTemplate({ name: "extension.ticket", readOnly: true }),
      makeTemplate({ name: "project-ticket" }),
    ]);
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTemplates,
    });

    await handler({ type: "ticket" });

    expect(listTemplates).toHaveBeenCalledWith("proj-1", { type: "ticket" });
    expect(log).toHaveBeenCalledTimes(1);
    const calls = log.mock.calls as unknown[][];
    const output = String(calls[0]?.[0]);
    expect(output).toContain("Source");
    expect(output).toContain("extension");
    expect(output).toContain("project");
  });
});
