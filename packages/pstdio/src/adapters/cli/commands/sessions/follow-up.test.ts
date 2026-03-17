import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type FollowUpArgs } from "./follow-up";

const argv = (args: Partial<FollowUpArgs>) => ({ _: [], $0: "", ...args }) as Arguments<FollowUpArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    followUpSession: mock(async () => ({
      id: "s_abc123",
      status: "in_progress",
      agent: "claude-code",
    })),
    ...overrides,
    log,
  };
};

describe("sessions follow-up", () => {
  test("sends follow-up and prints confirmation", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_abc123", prompt: "Continue with tests" }));

    expect(deps.followUpSession).toHaveBeenCalledWith(
      expect.any(String),
      "s_abc123",
      expect.objectContaining({ prompt: "Continue with tests" }),
    );
    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("Follow-up sent to session s_abc123");
    expect(output).toContain("claude-code");
    expect(output).toContain("in_progress");
  });

  test("passes agent and model overrides", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_1", prompt: "test", agent: "opencode", model: "gpt-5" }));

    expect(deps.followUpSession).toHaveBeenCalledWith(
      expect.any(String),
      "s_1",
      expect.objectContaining({ prompt: "test", agent: "opencode", model: "gpt-5" }),
    );
  });

  test("propagates API errors", async () => {
    const deps = makeDeps({
      followUpSession: mock(async () => {
        throw new Error("Session is in_progress");
      }),
    });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "s_1", prompt: "test" }))).rejects.toThrow("Session is in_progress");
  });
});
