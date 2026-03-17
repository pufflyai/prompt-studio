import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { type CreateArgs, createHandler } from "./create";

const argv = (args: Partial<CreateArgs>) => ({ _: [], $0: "", ...args }) as Arguments<CreateArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findGitRoot: () => "/fake/repo",
    readConfig: () => ({ project_id: "proj-1" }),
    createSession: mock(async () => ({
      id: "s_new123",
      project_id: "proj-1",
      title: "Test",
      status: "in_progress",
      agent: "claude-code",
    })),
    ...overrides,
    log,
  };
};

describe("sessions create", () => {
  test("creates a session and prints output", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ prompt: "Do something" }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("Created session s_new123");
    expect(output).toContain("claude-code");
    expect(output).toContain("in_progress");
  });

  test("includes workspace in output when provided", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ prompt: "Do something", "workspace-id": "PS-12_A1" }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("PS-12_A1");
  });

  test("derives title from prompt when no --title", async () => {
    const createSession = mock(async () => ({
      id: "s_1",
      project_id: "proj-1",
      title: "A long prompt that should be",
      status: "in_progress",
      agent: "claude-code",
    }));
    const deps = makeDeps({ createSession });
    const handler = createHandler(deps);

    await handler(argv({ prompt: "A long prompt that should be truncated to fifty characters maximum" }));

    expect(createSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: "A long prompt that should be truncated to fifty ch" }),
    );
  });

  test("throws when no project context", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ prompt: "test" }))).rejects.toThrow("Not inside a pstdio project");
  });
});
