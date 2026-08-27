import type { CommandExecuteBody, CreateAutomationRunInput } from "pstdio-api-contracts";
import type { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { SessionCancellationCleanupError } from "../sessions/session-request-cancellation";
import { type AutomationPolicyDeps, boundedError, boundedResult, recordRunActivity } from "./automation-policy";

type AutomationExecutionDeps = AutomationPolicyDeps & {
  executeCommand: typeof executeProjectExtensionCommand;
};

export const createAutomationRunExecutor = (deps: AutomationExecutionDeps) => {
  const finishRun = async (
    runId: string,
    status: "failed" | "rejected",
    error: { code: string; message: string; retryable: boolean },
  ) => {
    const run = await deps.automationDBService.transitionRun(runId, { status, error: boundedError(error) });
    if (run) await recordRunActivity(deps, run);
  };

  const cancelStoredRun = async (runId: string) => {
    const cancelled = await deps.automationDBService.transitionRun(runId, { status: "cancelled" });
    if (cancelled?.status === "cancelled") await recordRunActivity(deps, cancelled);
    return cancelled;
  };

  const settleResponse = async (
    runId: string,
    response: Awaited<ReturnType<typeof executeProjectExtensionCommand>>,
  ) => {
    if (response.outcome.ok) {
      const succeeded = await deps.automationDBService.transitionRun(runId, {
        status: "succeeded",
        result: boundedResult(response.outcome.value),
      });
      if (succeeded) await recordRunActivity(deps, succeeded);
      return;
    }
    await finishRun(runId, response.outcome.status === "rejected" ? "rejected" : "failed", {
      code: response.outcome.code ?? "command_failed",
      message: response.outcome.reason,
      retryable: false,
    });
  };

  const executeClaimedRun = async (
    running: NonNullable<Awaited<ReturnType<AutomationPolicyDeps["automationDBService"]["getRunById"]>>>,
    signal: AbortSignal,
  ) => {
    const request = running.input_json as CreateAutomationRunInput;
    try {
      const response = await deps.executeCommand(deps.getCommandDeps(), {
        projectId: running.project_id,
        commandId: running.command_id,
        body: { ...request.input, source: "automation" } as CommandExecuteBody,
        signal,
      });
      if (signal.aborted) return void (await cancelStoredRun(running.id));
      await settleResponse(running.id, response);
    } catch (error) {
      if (error instanceof SessionCancellationCleanupError) throw error;
      if (signal.aborted) {
        return void (await cancelStoredRun(running.id));
      }
      await finishRun(running.id, "failed", {
        code: "command_execution_failed",
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      });
    }
  };

  const executeRun = async (runId: string, signal: AbortSignal) => {
    if (signal.aborted) return void (await cancelStoredRun(runId));
    const running = await deps.automationDBService.claimQueuedRun(runId);
    if (!running) return;
    await recordRunActivity(deps, running);
    if (signal.aborted) return void (await cancelStoredRun(runId));
    await executeClaimedRun(running, signal);
  };

  return { cancelStoredRun, executeRun };
};
