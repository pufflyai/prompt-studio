import { describe, expect, type Mock, mock, test } from "bun:test";
import { PstdioApiError } from "@pstdio/sdk/client";
import type { Arguments } from "yargs";
import { createHandler, type FollowUpArgs } from "./follow-up";

const argv = (args: Partial<FollowUpArgs>) => ({ _: [], $0: "", ...args }) as Arguments<FollowUpArgs>;

type Deps = NonNullable<Parameters<typeof createHandler>[0]>;

const makeDeps = (overrides: Partial<Deps> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    steerSession: overrides.steerSession ?? mock(async () => ({ status: "accepted" as const, deliveryId: "delivery" })),
    getSteeringState:
      overrides.getSteeringState ??
      mock(async () => ({
        activeRunStartedAt: "run",
        steeringAvailable: true,
        steeringUnavailableReason: null,
        requests: [],
      })),
    setExitCode: overrides.setExitCode ?? mock(),
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
  test("steers a new prompt at the captured run and reports its delivery", async () => {
    const deps = makeDeps();
    await createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true }));
    expect(deps.followUpSession).not.toHaveBeenCalled();
    expect(deps.steerSession).toHaveBeenCalledWith("s_1", { prompt: "Correction", expectedRunStartedAt: "run" });
    expect(JSON.parse(deps.log.mock.calls[0][0])).toEqual({ status: "accepted", deliveryId: "delivery" });
    expect(deps.setExitCode).not.toHaveBeenCalled();
  });

  test("steers attached files and summaries without changing the active settings", async () => {
    const deps = makeDeps({ uploadAttachments: mock(async () => [{ file_id: "file" }]) as never });
    await createHandler(deps)(
      argv({ id: "s_1", "summary-of": "source", "summary-format": "detailed", attach: ["notes.txt"], steer: true }),
    );
    expect(deps.steerSession).toHaveBeenCalledWith("s_1", {
      expectedRunStartedAt: "run",
      summaryFromSessionId: "source",
      summaryFormat: "detailed",
      attachments: [{ fileId: "file" }],
    });
    expect(deps.deleteAttachments).not.toHaveBeenCalled();
  });

  test("unavailable steering fails before uploading or submitting a follow-up", async () => {
    const deps = makeDeps({
      getSteeringState: mock(async () => ({
        activeRunStartedAt: null,
        steeringAvailable: false,
        steeringUnavailableReason: "Inactive run",
        requests: [],
      })),
    });
    await expect(
      createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true, attach: ["notes.txt"] })),
    ).rejects.toThrow("Inactive run");
    expect(deps.uploadAttachments).not.toHaveBeenCalled();
    expect(deps.steerSession).not.toHaveBeenCalled();
    expect(deps.followUpSession).not.toHaveBeenCalled();
  });

  test.each(["agent", "model"] as const)("steering rejects --%s overrides", async (option) => {
    const deps = makeDeps();
    await expect(
      createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true, [option]: "other" })),
    ).rejects.toThrow(`--${option}`);
    expect(deps.steerSession).not.toHaveBeenCalled();
    expect(deps.followUpSession).not.toHaveBeenCalled();
  });

  test("rejected steering exits unsuccessfully and removes its unused uploads without fallback", async () => {
    const result = { status: "rejected" as const, reason: "stale_run" as const, message: "Active run changed" };
    const deps = makeDeps({
      steerSession: mock(async () => result),
      uploadAttachments: mock(async () => [{ file_id: "file" }]) as never,
    });
    await createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true, attach: ["notes.txt"] }));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(JSON.parse(deps.log.mock.calls[0][0])).toEqual(result);
    expect(deps.deleteAttachments).toHaveBeenCalledWith({ projectId: "proj-1", attachments: [{ file_id: "file" }] });
    expect(deps.followUpSession).not.toHaveBeenCalled();
  });

  test("uncertain steering exits unsuccessfully and retains its attachments and delivery identity", async () => {
    const result = { status: "uncertain" as const, deliveryId: "delivery", message: "Acknowledgement lost" };
    const deps = makeDeps({
      steerSession: mock(async () => result),
      uploadAttachments: mock(async () => [{ file_id: "file" }]) as never,
    });
    await createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true, attach: ["notes.txt"] }));
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
    expect(JSON.parse(deps.log.mock.calls[0][0])).toEqual(result);
    expect(deps.deleteAttachments).not.toHaveBeenCalled();
    expect(deps.followUpSession).not.toHaveBeenCalled();
  });

  test.each([
    new Error("Connection lost"),
    new PstdioApiError("Request timed out", 408),
  ])("a failed steering HTTP request retains attachments that may have been delivered: %s", async (error) => {
    const deps = makeDeps({
      steerSession: mock(async () => {
        throw error;
      }),
      uploadAttachments: mock(async () => [{ file_id: "file" }]) as never,
    });
    await expect(
      createHandler(deps)(argv({ id: "s_1", prompt: "Correction", steer: true, attach: ["notes.txt"] })),
    ).rejects.toThrow(error.message);
    expect(deps.deleteAttachments).not.toHaveBeenCalled();
    expect(deps.followUpSession).not.toHaveBeenCalled();
  });

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

    expect(handler(argv({ id: "s_1" }))).rejects.toThrow("At least one of --prompt or --summary-of is required.");
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
