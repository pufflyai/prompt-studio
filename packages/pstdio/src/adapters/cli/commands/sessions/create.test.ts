import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { type CreateArgs, createHandler } from "./create";

const argv = (args: Partial<CreateArgs>) => ({ _: [], $0: "", ...args }) as Arguments<CreateArgs>;

const makeSessionResponse = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "s_new123",
    project_id: "proj-1",
    title: "Test",
    status: "in_progress",
    archived: false,
    last_request_started: null,
    last_request_ended: null,
    agent_session_id: null,
    agent: "claude-code",
    last_selected_model: null,
    workspace_id: null,
    created_at: "2026-03-05T10:00:00Z",
    updated_at: "2026-03-05T10:00:00Z",
    ...overrides,
  }) as never;

type Deps = NonNullable<Parameters<typeof createHandler>[0]>;

const makeDeps = (overrides: Partial<Deps> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: overrides.cwd ?? (() => "/fake/repo"),
    findGitRoot: overrides.findGitRoot ?? (() => "/fake/repo"),
    readConfig: overrides.readConfig ?? (() => ({ project_id: "proj-1" })),
    createSession: overrides.createSession ?? mock(async () => makeSessionResponse()),
    uploadAttachments: overrides.uploadAttachments ?? mock(async () => undefined),
    deleteAttachments: overrides.deleteAttachments ?? mock(async () => undefined),
    log,
  };
};

describe("sessions create", () => {
  test("omits agent when --agent is not provided", async () => {
    const createSession = mock(async () => makeSessionResponse({ id: "s_1", agent: "fake" }));
    const deps = makeDeps({ createSession });
    const handler = createHandler(deps);

    await handler(argv({ prompt: "Do something" }));

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ agent: undefined }));
  });

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
    const createSession = mock(async () => makeSessionResponse({ id: "s_1", title: "A long prompt that should be" }));
    const deps = makeDeps({ createSession });
    const handler = createHandler(deps);

    await handler(argv({ prompt: "A long prompt that should be truncated to fifty characters maximum" }));

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A long prompt that should be truncated to fifty ch" }),
    );
  });

  test("uploads attached files before creating the session", async () => {
    const createSession = mock(async () => makeSessionResponse({ id: "s_1" }));
    const uploadAttachments = mock(async () => [{ file_id: "file-1" }, { file_id: "file-2" }]);
    const deps = makeDeps({ createSession, uploadAttachments });
    const handler = createHandler(deps);

    await handler(argv({ prompt: "Use these files", attach: ["notes.txt", "diagram.png"] }));

    expect(uploadAttachments).toHaveBeenCalledWith({
      projectId: "proj-1",
      paths: ["notes.txt", "diagram.png"],
      cwd: "/fake/repo",
    });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ file_id: "file-1" }, { file_id: "file-2" }],
      }),
    );
  });

  test("deletes uploaded attachments when session creation fails", async () => {
    const createSession = mock(async () => {
      throw new Error("create failed");
    });
    const uploadAttachments = mock(async () => [{ file_id: "file-1" }, { file_id: "file-2" }]);
    const deleteAttachments = mock(async () => undefined);
    const deps = makeDeps({ createSession, uploadAttachments, deleteAttachments });
    const handler = createHandler(deps);

    await expect(handler(argv({ prompt: "Use these files", attach: ["notes.txt", "diagram.png"] }))).rejects.toThrow(
      "create failed",
    );

    expect(deleteAttachments).toHaveBeenCalledWith({
      projectId: "proj-1",
      attachments: [{ file_id: "file-1" }, { file_id: "file-2" }],
    });
  });

  test("throws when no project context", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ prompt: "test" }))).rejects.toThrow("Not inside a pstdio project");
  });
});
