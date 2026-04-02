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

  test("passes summary-of flags", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(
      argv({
        id: "s_impl",
        "summary-of": "s_review",
        "summary-format": "detailed",
        "summary-role": "all",
      }),
    );

    expect(deps.followUpSession).toHaveBeenCalledWith(expect.any(String), "s_impl", {
      summary_from_session_id: "s_review",
      summary_format: "detailed",
      summary_role: "all",
    });
  });

  test("passes both prompt and summary-of together", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(
      argv({
        id: "s_impl",
        prompt: "Apply the review feedback",
        "summary-of": "s_review",
      }),
    );

    expect(deps.followUpSession).toHaveBeenCalledWith(expect.any(String), "s_impl", {
      prompt: "Apply the review feedback",
      summary_from_session_id: "s_review",
    });
  });

  test("fails when neither prompt nor summary-of is provided", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    expect(handler(argv({ id: "s_1" }))).rejects.toThrow(
      "At least one of --prompt, --template, or --summary-of is required.",
    );
  });

  test("passes template and vars to API", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_1", template: "fix-it", var: ["ticket=PS-7", "output=error log"] }));

    expect(deps.followUpSession).toHaveBeenCalledWith(expect.any(String), "s_1", {
      template: "fix-it",
      vars: { ticket: "PS-7", output: "error log" },
    });
  });

  test("rejects --prompt and --template together", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    expect(handler(argv({ id: "s_1", prompt: "inline", template: "tpl" }))).rejects.toThrow(
      "--prompt and --template are mutually exclusive",
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
