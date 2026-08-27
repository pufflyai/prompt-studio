import { createHash, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import type { AutomationRunError } from "pstdio-api-contracts";
import type { createAutomationDBService } from "pstdio-db";
import type { ExtensionsRouteDeps } from "../extensions/deps";

export const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
export const MAX_INPUT_BYTES = 64 * 1024;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_ERROR_BYTES = 8 * 1024;
export const DEFAULT_RUNS_PER_MINUTE = 60;
export const RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;
export const automationTextEncoder = new TextEncoder();

export type AutomationPolicyDeps = {
  automationDBService: ReturnType<typeof createAutomationDBService>;
  getCommandDeps: () => ExtensionsRouteDeps;
  consumeAuthAttempt?: (tokenId: string) => void;
};

export class AutomationRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
  ) {
    super(message);
  }
}

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

export const inputHash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("base64url");
const idempotencyFingerprint = (value: string) => createHash("sha256").update(value).digest("base64url").slice(0, 16);

export const digestTokenSecret = (secret: string, salt: string) =>
  `${salt}.${Buffer.from(scryptSync(secret, salt, 32)).toString("base64url")}`;

const deriveTokenSecret = (secret: string, salt: string, length: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(secret, salt, length, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });

const tokenSecretMatches = async (secret: string, stored: string) => {
  const [salt, expectedValue] = stored.split(".");
  if (!salt || !expectedValue) return false;
  const expected = Buffer.from(expectedValue, "base64url");
  const actual = await deriveTokenSecret(secret, salt, expected.byteLength);
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
};

const parseToken = (raw: string) => {
  const match = raw.match(/^pst_at_([0-9a-f-]{36})_([A-Za-z0-9_-]+)$/i);
  return match ? { id: match[1], secret: match[2] } : null;
};

export const toTokenRecord = (row: Awaited<ReturnType<AutomationPolicyDeps["automationDBService"]["getToken"]>>) => {
  if (!row) return null;
  return {
    id: row.token.id,
    principalId: row.principal.id,
    name: row.principal.name,
    tokenPrefix: row.token.token_prefix,
    projectId: row.token.project_id,
    commandScopes: row.token.command_scopes_json,
    expiresAt: row.token.expires_at,
    lastUsedAt: row.token.last_used_at,
    revokedAt: row.token.revoked_at,
    createdAt: row.token.created_at,
  };
};

export const toRunRecord = (
  run: NonNullable<Awaited<ReturnType<AutomationPolicyDeps["automationDBService"]["getRun"]>>>,
) => ({
  id: run.id,
  projectId: run.project_id,
  commandId: run.command_id,
  status: run.status,
  createdAt: run.created_at,
  startedAt: run.started_at,
  finishedAt: run.finished_at,
  result: run.result_json ?? null,
  error: run.error_json ?? null,
});

export const boundedResult = (value: unknown) => {
  const serialized = JSON.stringify(value ?? null);
  if (automationTextEncoder.encode(serialized).byteLength > MAX_RESULT_BYTES) {
    throw new Error("Command result exceeds the automation result limit.");
  }
  return JSON.parse(serialized) as unknown;
};

export const boundedError = (error: AutomationRunError): AutomationRunError => {
  if (automationTextEncoder.encode(JSON.stringify(error)).byteLength <= MAX_ERROR_BYTES) return error;
  return {
    code: "command_error_too_large",
    message: "Command error exceeded the automation error limit.",
    retryable: false,
  };
};

export const authenticateAutomationToken = async (deps: AutomationPolicyDeps, rawToken: string | null) => {
  const parsed = rawToken ? parseToken(rawToken) : null;
  if (!parsed) throw new AutomationRequestError("invalid_machine_token", "Invalid machine token.", 401);
  const row = await deps.automationDBService.getToken(parsed.id);
  if (!row || row.token.revoked_at || row.principal.disabled_at || Date.parse(row.token.expires_at) <= Date.now()) {
    throw new AutomationRequestError("invalid_machine_token", "Invalid machine token.", 401);
  }
  deps.consumeAuthAttempt?.(parsed.id);
  if (!(await tokenSecretMatches(parsed.secret, row.token.token_digest))) {
    throw new AutomationRequestError("invalid_machine_token", "Invalid machine token.", 401);
  }
  await deps.automationDBService.markTokenUsed(row.token.id);
  return row;
};

export const authorizeAutomationToken = async (
  deps: AutomationPolicyDeps,
  rawToken: string | null,
  projectId: string,
  commandId?: string,
) => {
  const auth = await authenticateAutomationToken(deps, rawToken);
  if (auth.token.project_id !== projectId || (commandId && !auth.token.command_scopes_json.includes(commandId))) {
    await deps
      .getCommandDeps()
      .activityEventsService.create({
        projectId: auth.token.project_id,
        resourceType: "automation_principal",
        resourceId: auth.principal.id,
        eventType: "automation.scope_denied",
        actorType: "system",
        actorId: auth.principal.id,
        source: "api",
        summary: "Machine token scope denied",
        payloadJson: { requestedProjectId: projectId, requestedCommandId: commandId ?? null },
      })
      .catch(() => undefined);
    throw new AutomationRequestError("automation_scope_denied", "Machine token scope denied.", 403);
  }
  return auth;
};

export type AutomationAuth = Awaited<ReturnType<typeof authenticateAutomationToken>>;

type AutomationRunRow = NonNullable<Awaited<ReturnType<AutomationPolicyDeps["automationDBService"]["getRunById"]>>>;

export const recordRunActivity = async (deps: AutomationPolicyDeps, run: AutomationRunRow) => {
  await deps
    .getCommandDeps()
    .activityEventsService.create({
      projectId: run.project_id,
      resourceType: "automation_run",
      resourceId: run.id,
      eventType: `automation.${run.status}`,
      actorType: "agent",
      actorId: run.principal_id,
      source: "api",
      summary: `Automation run ${run.status}`,
      payloadJson: {
        commandId: run.command_id,
        principalId: run.principal_id,
        idempotencyFingerprint: idempotencyFingerprint(run.idempotency_key),
        status: run.status,
      },
    })
    .catch(() => undefined);
};

export const bearerTokenFrom = (request: Request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^bearer\s+/i.test(authorization)) return null;
  return authorization.replace(/^bearer\s+/i, "").trim();
};
