import { randomBytes } from "node:crypto";
import type { CreateAutomationRunInput, IssueAutomationTokenInput } from "pstdio-api-contracts";
import { apiLogger } from "../../lib/logger";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { SessionCancellationCleanupError } from "../sessions/session-request-cancellation";
import { admitAutomationRun } from "./automation-admission";
import { createAutomationRunExecutor } from "./automation-execution";
import {
  type AutomationPolicyDeps,
  AutomationRequestError,
  authenticateAutomationToken,
  authorizeAutomationToken,
  automationTextEncoder,
  canonicalJson,
  DEFAULT_RUNS_PER_MINUTE,
  DEFAULT_SHUTDOWN_GRACE_MS,
  digestTokenSecret,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_INPUT_BYTES,
  toRunRecord,
  toTokenRecord,
} from "./automation-policy";

const TOKEN_PREFIX = "pst_at";

type AutomationServiceDeps = AutomationPolicyDeps & {
  maxRunsPerMinute?: number;
  maxAuthAttemptsPerMinute?: number;
  executeCommand?: typeof executeProjectExtensionCommand;
  shutdownGraceMs?: number;
};

const createAuthAttemptConsumer = (maxAttemptsPerMinute: number) => {
  const attempts = new Map<string, { count: number; windowStartedAt: number }>();
  return (tokenId: string) => {
    const now = Date.now();
    const current = attempts.get(tokenId);
    if (!current || now - current.windowStartedAt >= 60_000) {
      attempts.set(tokenId, { count: 1, windowStartedAt: now });
      return;
    }
    if (current.count >= maxAttemptsPerMinute) {
      throw new AutomationRequestError(
        "automation_auth_rate_limited",
        "Machine token authentication rate limit exceeded.",
        429,
      );
    }
    current.count += 1;
  };
};

export const createAutomationService = (deps: AutomationServiceDeps) => {
  const activeRuns = new Map<
    string,
    { controller: AbortController; execution: Promise<void>; cleanupFailed: boolean }
  >();
  const admissionLocks = new Map<string, Promise<void>>();
  const maxRunsPerMinute = deps.maxRunsPerMinute ?? DEFAULT_RUNS_PER_MINUTE;
  const executeCommand = deps.executeCommand ?? executeProjectExtensionCommand;
  const shutdownGraceMs = deps.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;
  const consumeAuthAttempt = createAuthAttemptConsumer(deps.maxAuthAttemptsPerMinute ?? 120);
  const policyDeps = { ...deps, consumeAuthAttempt };
  const runExecutor = createAutomationRunExecutor({ ...policyDeps, executeCommand });

  const withAdmissionLock = async <T>(key: string, task: () => Promise<T>) => {
    const previous = admissionLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    admissionLocks.set(key, current);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (admissionLocks.get(key) === current) admissionLocks.delete(key);
    }
  };

  const issueToken = async (input: IssueAutomationTokenInput) => {
    const commandDeps = deps.getCommandDeps();
    const snapshot = await commandDeps.extensionRuntimeCatalog.get(input.projectId);
    const allowedCommands = new Set(
      snapshot.runtime.commands.filter((command) => command.automation).map((command) => command.id),
    );
    const invalidScope = input.commandScopes.find((scope) => !allowedCommands.has(scope));
    if (invalidScope) {
      throw new AutomationRequestError(
        "command_not_automation_enabled",
        `Command is not exposed to automation: ${invalidScope}`,
        400,
      );
    }
    if (input.principalId && !(await deps.automationDBService.getPrincipal(input.projectId, input.principalId))) {
      throw new AutomationRequestError(
        "automation_principal_not_found",
        "Automation principal not found for project.",
        400,
      );
    }

    const tokenId = crypto.randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const rawToken = `${TOKEN_PREFIX}_${tokenId}_${secret}`;
    const stored = await deps.automationDBService.createToken({
      name: input.name,
      createdBy: "local-user",
      principalId: input.principalId,
      tokenId,
      tokenPrefix: `${TOKEN_PREFIX}_${tokenId}`,
      tokenDigest: digestTokenSecret(secret, randomBytes(16).toString("base64url")),
      projectId: input.projectId,
      commandScopes: [...new Set(input.commandScopes)],
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    });
    return { ...toTokenRecord(stored)!, token: rawToken };
  };

  const listTokens = async (projectId: string) =>
    (await deps.automationDBService.listTokens(projectId)).map((row) => toTokenRecord(row)!);

  const auditDeniedRoute = async (rawToken: string | null, path: string) => {
    const auth = await authenticateAutomationToken(policyDeps, rawToken);
    await deps.getCommandDeps().activityEventsService.create({
      projectId: auth.token.project_id,
      resourceType: "automation_principal",
      resourceId: auth.principal.id,
      eventType: "automation.route_denied",
      actorType: "system",
      actorId: auth.principal.id,
      source: "api",
      summary: "Machine token route denied",
      payloadJson: { requestedPath: path },
    });
  };

  const revokeToken = async (tokenId: string) => {
    const token = await deps.automationDBService.revokeToken(tokenId);
    if (!token) throw new AutomationRequestError("machine_token_not_found", "Machine token not found.", 404);
  };

  const startExecution = (runId: string) => {
    if (activeRuns.has(runId)) return;
    const controller = new AbortController();
    const active = { controller, execution: Promise.resolve(), cleanupFailed: false };
    const execution = Promise.resolve()
      .then(() => runExecutor.executeRun(runId, controller.signal))
      .catch((error) => {
        if (error instanceof SessionCancellationCleanupError) active.cleanupFailed = true;
        apiLogger.error(
          { err: error, event: "automation.execution.failed", run_id: runId },
          "Detached automation execution failed",
        );
      })
      .finally(() => {
        if (!active.cleanupFailed && activeRuns.get(runId)?.execution === execution) activeRuns.delete(runId);
      });
    active.execution = execution;
    activeRuns.set(runId, active);
  };

  const createRun = async (input: {
    rawToken: string | null;
    projectId: string;
    idempotencyKey: string | null;
    body: CreateAutomationRunInput;
  }) => {
    if (!input.idempotencyKey || input.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new AutomationRequestError("invalid_idempotency_key", "A valid Idempotency-Key header is required.", 400);
    }
    if (automationTextEncoder.encode(canonicalJson(input.body)).byteLength > MAX_INPUT_BYTES) {
      throw new AutomationRequestError("invalid_automation_input", "Automation input is too large.", 400);
    }
    const auth = await authorizeAutomationToken(policyDeps, input.rawToken, input.projectId, input.body.commandId);
    const admissionKey = `${auth.principal.id}:${input.projectId}`;
    return withAdmissionLock(admissionKey, () =>
      admitAutomationRun({
        deps,
        auth,
        projectId: input.projectId,
        idempotencyKey: input.idempotencyKey!,
        body: input.body,
        maxRunsPerMinute,
        startExecution,
      }),
    );
  };

  const getAuthorizedRun = async (rawToken: string | null, projectId: string, runId: string) => {
    const auth = await authorizeAutomationToken(policyDeps, rawToken, projectId);
    const run = await deps.automationDBService.getRun(projectId, runId);
    if (!run || run.principal_id !== auth.principal.id || !auth.token.command_scopes_json.includes(run.command_id)) {
      throw new AutomationRequestError("automation_run_not_found", "Automation run not found.", 404);
    }
    return run;
  };

  const getRun = async (rawToken: string | null, projectId: string, runId: string) =>
    toRunRecord(await getAuthorizedRun(rawToken, projectId, runId));

  const listRunEvents = async (rawToken: string | null, projectId: string, runId: string, after: number) => {
    await getAuthorizedRun(rawToken, projectId, runId);
    return (await deps.automationDBService.listRunEvents(runId, after)).map((event) => ({
      cursor: event.cursor,
      runId: event.run_id,
      type: event.type,
      payload: event.payload_json,
      createdAt: event.created_at,
    }));
  };

  const waitForExecutions = async (executions: Promise<void>[]) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.allSettled(executions).then(() => true),
        new Promise<false>((resolve) => {
          timeout = setTimeout(() => resolve(false), shutdownGraceMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const cancelRun = async (rawToken: string | null, projectId: string, runId: string) => {
    const run = await getAuthorizedRun(rawToken, projectId, runId);
    const active = activeRuns.get(run.id);
    if (active) {
      active.controller.abort(new DOMException("Automation run cancelled.", "AbortError"));
      if (!(await waitForExecutions([active.execution]))) {
        throw new AutomationRequestError("automation_cancellation_pending", "Automation run is still stopping.", 409);
      }
      if (active.cleanupFailed) {
        throw new AutomationRequestError(
          "automation_cancellation_pending",
          "Automation run cancellation cleanup is not confirmed.",
          409,
        );
      }
      const settled = await runExecutor.cancelStoredRun(run.id);
      if (!settled) throw new AutomationRequestError("automation_run_not_found", "Automation run not found.", 404);
      return toRunRecord(settled);
    }
    return toRunRecord((await runExecutor.cancelStoredRun(run.id))!);
  };

  const close = async () => {
    const active = [...activeRuns.values()];
    if (active.length === 0) return;
    for (const run of active) run.controller.abort(new DOMException("Prompt Studio is shutting down.", "AbortError"));
    await waitForExecutions(active.map((run) => run.execution));
  };

  const recoverQueuedRuns = async () => {
    const queued = await deps.automationDBService.listQueuedRuns();
    for (const run of queued) startExecution(run.id);
    return queued.length;
  };

  return {
    auditDeniedRoute,
    cancelRun,
    close,
    createRun,
    getRun,
    issueToken,
    listRunEvents,
    listTokens,
    recoverQueuedRuns,
    revokeToken,
  };
};
