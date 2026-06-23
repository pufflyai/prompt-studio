import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type FollowUpArgs } from "./follow-up";

const argv = (args: Partial<FollowUpArgs>) => ({ _: [], $0: "", ...args }) as Arguments<FollowUpArgs>;

type Deps = NonNullable<Parameters<typeof createHandler>[0]>;

const makeDeps = (overrides: Partial<Deps> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    followUpSession:
      overrides.followUpSession ??
      mock(
        async () =>
          ({
            id: "s_abc123",
            status: "in_progress",
            agent: "claude-code",
          }) as never,
      ),
    getSession:
      overrides.getSession ??
      mock(
        async () =>
          ({
            project_id: "proj-1",
          }) as never,
      ),
    uploadAttachments: overrides.uploadAttachments ?? mock(async () => undefined),
    deleteAttachments: overrides.deleteAttachments ?? mock(async () => undefined),
    cwd: overrides.cwd ?? (() => "/fake/repo"),
    log,
  };
};

describe("sessions follow-up", () => {
  test("sends follow-up and prints confirmation", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_abc123", prompt: "Continue with tests" }));

    expect(deps.followUpSession).toHaveBeenCalledWith(
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

    expect(deps.followUpSession).toHaveBeenCalledWith("s_impl", {
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

    expect(deps.followUpSession).toHaveBeenCalledWith("s_impl", {
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

    expect(deps.followUpSession).toHaveBeenCalledWith("s_1", {
      template: "fix-it",
      vars: { ticket: "PS-7", output: "error log" },
    });
  });

  test("uploads attached files before sending the follow-up", async () => {
    const uploadAttachments = mock(async () => [{ file_id: "file-1" }, { file_id: "file-2" }]);
    const deps = makeDeps({ uploadAttachments });
    const handler = createHandler(deps);

    await handler(argv({ id: "s_1", prompt: "Use these files", attach: ["notes.txt", "diagram.png"] }));

    expect(deps.getSession).toHaveBeenCalledWith("s_1");
    expect(uploadAttachments).toHaveBeenCalledWith({
      projectId: "proj-1",
      paths: ["notes.txt", "diagram.png"],
      cwd: "/fake/repo",
    });
    expect(deps.followUpSession).toHaveBeenCalledWith("s_1", {
      prompt: "Use these files",
      attachments: [{ file_id: "file-1" }, { file_id: "file-2" }],
    });
  });

  test("deletes uploaded attachments when follow-up fails", async () => {
    const followUpSession = mock(async () => {
      throw new Error("follow-up failed");
    });
    const uploadAttachments = mock(async () => [{ file_id: "file-1" }, { file_id: "file-2" }]);
    const deleteAttachments = mock(async () => undefined);
    const deps = makeDeps({ followUpSession, uploadAttachments, deleteAttachments });
    const handler = createHandler(deps);

    await expect(
      handler(argv({ id: "s_1", prompt: "Use these files", attach: ["notes.txt", "diagram.png"] })),
    ).rejects.toThrow("follow-up failed");

    expect(deleteAttachments).toHaveBeenCalledWith({
      projectId: "proj-1",
      attachments: [{ file_id: "file-1" }, { file_id: "file-2" }],
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
      }) as never,
    });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "s_1", prompt: "test" }))).rejects.toThrow("Session is in_progress");
  });
});
