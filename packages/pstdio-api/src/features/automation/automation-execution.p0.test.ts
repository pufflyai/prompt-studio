import { expect, mock, test } from "bun:test";
import { SessionCancellationCleanupError } from "../sessions/session-request-cancellation";
import { createAutomationRunExecutor } from "./automation-execution";

test("automation execution stays running when session cancellation cleanup is unconfirmed", async () => {
  const controller = new AbortController();
  const running = {
    id: "run-1",
    project_id: "project-1",
    principal_id: "principal-1",
    token_id: "token-1",
    command_id: "example.command",
    idempotency_key: "key-1",
    input_hash: "hash-1",
    input_json: { commandId: "example.command", input: {} },
    status: "running",
  };
  const transitionRun = mock(async () => running);
  const executor = createAutomationRunExecutor({
    automationDBService: {
      claimQueuedRun: async () => running,
      transitionRun,
    } as never,
    getCommandDeps: () => ({ activityEventsService: { create: async () => {} } }) as never,
    executeCommand: async () => {
      controller.abort();
      throw new SessionCancellationCleanupError(new Error("remote stop failed"));
    },
  });

  await expect(executor.executeRun(running.id, controller.signal)).rejects.toBeInstanceOf(
    SessionCancellationCleanupError,
  );
  expect(transitionRun).not.toHaveBeenCalled();
});
