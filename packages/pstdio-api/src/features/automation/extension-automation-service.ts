import {
  type AutomationRun,
  type AutomationRunStatus,
  type CreateAutomationRunInput,
  createAutomationRunInputSchema,
} from "pstdio-api-contracts";
import { admitAutomationRun } from "./automation-admission";
import {
  type AutomationPolicyDeps,
  AutomationRequestError,
  automationTextEncoder,
  canonicalJson,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_INPUT_BYTES,
  toRunRecord,
} from "./automation-policy";

type ExtensionOwner = { projectId: string; extensionId: string };

export const createExtensionAutomationService = (options: {
  deps: AutomationPolicyDeps;
  withAdmissionLock: <T>(key: string, task: () => Promise<T>) => Promise<T>;
  maxRunsPerMinute: number;
  startExecution: (runId: string) => void;
  cancelOwnedRun: (runId: string) => Promise<AutomationRun>;
}) => {
  const { deps } = options;
  const enqueueForExtension = async (
    input: ExtensionOwner & { commandId: string; input: CreateAutomationRunInput["input"]; key: string },
  ) => {
    if (!input.key || input.key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new AutomationRequestError("invalid_idempotency_key", "A key of 1 to 200 characters is required.", 400);
    }
    const parsed = createAutomationRunInputSchema.safeParse({ commandId: input.commandId, input: input.input });
    if (!parsed.success || automationTextEncoder.encode(canonicalJson(parsed.data)).byteLength > MAX_INPUT_BYTES) {
      throw new AutomationRequestError("invalid_automation_input", "Invalid automation input.", 400);
    }
    const snapshot = await deps.getCommandDeps().extensionRuntimeCatalog.get(input.projectId);
    const command = snapshot.runtime.commands.find((candidate) => candidate.id === input.commandId);
    if (!command?.automation || command.extensionId !== input.extensionId) {
      throw new AutomationRequestError(
        "automation_scope_denied",
        "Command must belong to this extension and enable automation.",
        403,
      );
    }
    const principal = await deps.automationDBService.getOrCreateExtensionPrincipal(input);
    if (principal.disabled_at)
      throw new AutomationRequestError("automation_scope_denied", "Automation principal is disabled.", 403);
    return options.withAdmissionLock(`${principal.id}:${input.projectId}`, () =>
      admitAutomationRun({
        deps,
        auth: { principal, token: null },
        projectId: input.projectId,
        body: parsed.data,
        idempotencyKey: input.key,
        maxRunsPerMinute: options.maxRunsPerMinute,
        startExecution: options.startExecution,
      }),
    );
  };
  const getForExtension = async (owner: ExtensionOwner, runId: string) => {
    const run = await deps.automationDBService.getExtensionRun(owner, runId);
    return run ? toRunRecord(run) : undefined;
  };
  const listForExtension = async (owner: ExtensionOwner, filter?: { status?: AutomationRunStatus[] }) =>
    (await deps.automationDBService.listExtensionRuns(owner, filter)).map(toRunRecord);
  const cancelForExtension = async (owner: ExtensionOwner, runId: string) => {
    const run = await deps.automationDBService.getExtensionRun(owner, runId);
    if (!run) throw new AutomationRequestError("automation_run_not_found", "Automation run not found.", 404);
    return options.cancelOwnedRun(run.id);
  };
  return { enqueueForExtension, getForExtension, listForExtension, cancelForExtension };
};
