import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./update";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("agents update handler", () => {
  test("calls updateAgent with --default flag", async () => {
    const updateAgent = mock(async () => ({
      id: "1",
      agent_id: "opencode",
      is_default: true,
      config: "{}",
      created_at: "t",
      updated_at: "t",
    }));
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({ updateAgent });
    await handler({ "agent-id": "opencode", default: true } as never);

    expect(updateAgent).toHaveBeenCalledWith("opencode", {
      is_default: true,
      binary: undefined,
      skills_dir: undefined,
    });
    expect(log).toHaveBeenCalledWith('Agent "opencode" updated (default).');
  });

  test("calls updateAgent with --binary and --skills-dir flags", async () => {
    const updateAgent = mock(async () => ({
      id: "1",
      agent_id: "claude-code",
      is_default: false,
      config: '{"binary":"/bin/claude","skills_dir":"/s"}',
      created_at: "t",
      updated_at: "t",
    }));
    const log = mock(() => {});
    console.log = log as typeof console.log;

    const handler = createHandler({ updateAgent });
    await handler({
      "agent-id": "claude-code",
      default: undefined,
      binary: "/bin/claude",
      "skills-dir": "/s",
    } as never);

    expect(updateAgent).toHaveBeenCalledWith("claude-code", {
      is_default: undefined,
      binary: "/bin/claude",
      skills_dir: "/s",
    });
    expect(log).toHaveBeenCalledWith('Agent "claude-code" updated.');
  });

  test("throws for unknown agent", async () => {
    const updateAgent = mock(async () => ({}) as never);
    const handler = createHandler({ updateAgent });

    await expect(handler({ "agent-id": "unknown" } as never)).rejects.toThrow("Unknown agent: unknown");
    expect(updateAgent).not.toHaveBeenCalled();
  });
});
