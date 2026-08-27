import type { CreateAutomationRunInput } from "pstdio-api-contracts";
import { validateCommandParams } from "pstdio-extensions";
import {
  type AutomationAuth,
  type AutomationPolicyDeps,
  AutomationRequestError,
  inputHash,
  RUN_RETENTION_MS,
  recordRunActivity,
  toRunRecord,
} from "./automation-policy";

export const admitAutomationRun = async (input: {
  deps: AutomationPolicyDeps;
  auth: AutomationAuth;
  projectId: string;
  idempotencyKey: string;
  body: CreateAutomationRunInput;
  maxRunsPerMinute: number;
  startExecution: (runId: string) => void;
}) => {
  const { deps, auth, projectId, idempotencyKey, body, maxRunsPerMinute, startExecution } = input;
  await deps.automationDBService.pruneTerminalRuns(new Date(Date.now() - RUN_RETENTION_MS).toISOString());
  const hash = inputHash(body);
  const existing = await deps.automationDBService.getRunByIdempotency({
    principalId: auth.principal.id,
    projectId,
    commandId: body.commandId,
    idempotencyKey,
  });
  if (existing) {
    if (existing.input_hash !== hash) {
      throw new AutomationRequestError(
        "idempotency_conflict",
        "The idempotency key was already used with different input.",
        409,
      );
    }
    if (existing.status === "queued") startExecution(existing.id);
    return toRunRecord(existing);
  }

  const recentRuns = await deps.automationDBService.countRecentRuns({
    principalId: auth.principal.id,
    projectId,
    since: new Date(Date.now() - 60_000).toISOString(),
  });
  if (recentRuns >= maxRunsPerMinute) {
    throw new AutomationRequestError("automation_rate_limited", "Automation run rate limit exceeded.", 429);
  }

  const commandDeps = deps.getCommandDeps();
  const snapshot = await commandDeps.extensionRuntimeCatalog.get(projectId);
  const command = snapshot.runtime.commands.find(
    (candidate) => candidate.id === body.commandId && candidate.automation,
  );
  if (!command) throw new AutomationRequestError("automation_scope_denied", "Machine token scope denied.", 403);
  const validation = validateCommandParams(command.params, body.input.params ?? {});
  if (!validation.ok) throw new AutomationRequestError("invalid_automation_input", validation.reason, 400);

  const stored = await deps.automationDBService.createRun({
    projectId,
    principalId: auth.principal.id,
    tokenId: auth.token.id,
    commandId: body.commandId,
    idempotencyKey,
    inputHash: hash,
    inputJson: body as Record<string, unknown>,
  });
  if (!stored.created && stored.run.input_hash !== hash) {
    throw new AutomationRequestError(
      "idempotency_conflict",
      "The idempotency key was already used with different input.",
      409,
    );
  }
  if (stored.created) await recordRunActivity(deps, stored.run);
  if (stored.run.status === "queued") startExecution(stored.run.id);
  return toRunRecord(stored.run);
};
