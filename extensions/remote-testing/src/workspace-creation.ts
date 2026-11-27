import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { type Api, connectionApi } from "./connection";
import { type Claim, type Environment, releaseEnvironment, stopEnvironment } from "./environments";
import { TRANSFER_ALLOWANCE_SECONDS } from "./run-deadline";
import type { Settings } from "./settings";

const CREATE_TIMEOUT_MS = 30_000;
const CREATION_LEASE_MS = 2 * 60_000;
const RECOVERY_REQUEST_TIMEOUT_MS = 5_000;
const RECOVERY_CONCURRENCY = 4;
const canCancel = ["queued", "provisioning", "connected", "ready"];
const stoppingOrEnded = ["terminating", "preserving", "succeeded", "failed", "canceled", "expired", "preserved"];

type Purpose = "remote-testing" | "pstdio-preview";
type Creation = {
  externalId: string;
  runId: string;
  purpose: Purpose;
  leaseUntil: number;
  abandoned?: true;
};
type CreationDeps = { api: Api; store: ExtensionStorageApi; projectId: string };
const creations = (store: ExtensionStorageApi) => store.collection<Creation>("workspace-creations");
const needsRecovery = (intent: Creation) => intent.abandoned || intent.leaseUntil <= Date.now();

export async function hasRecoverableCreations(store: ExtensionStorageApi) {
  return (await creations(store).list()).some(needsRecovery);
}

export async function createTrackedEnvironment(
  deps: CreationDeps,
  settings: Settings,
  input: {
    runId: string;
    purpose?: Purpose;
    metadata?: Record<string, string>;
    adopt?: (environment: Environment) => Promise<void>;
  },
  signal?: AbortSignal,
) {
  const purpose = input.purpose ?? "remote-testing";
  const externalId = `${purpose}-${input.runId}`;
  const intent: Creation = { externalId, runId: input.runId, purpose, leaseUntil: Date.now() + CREATION_LEASE_MS };
  const pending = creations(deps.store);
  if (!(await pending.createIfAbsent(externalId, intent))) throw new Error("Workspace creation is already recorded.");
  try {
    signal?.throwIfAborted();
    if (Date.now() >= intent.leaseUntil) throw new Error("Workspace creation expired before submission.");
    const environment = await deps.api<Environment>({
      method: "POST",
      path: "/v1/workspaces",
      headers: { "Idempotency-Key": externalId },
      body: {
        external_id: externalId,
        template: { name: settings.templateName, version: settings.templateVersion },
        metadata: { ...input.metadata, purpose, pstdio_project_id: deps.projectId },
      },
      signal,
      timeoutMs: CREATE_TIMEOUT_MS,
    });
    signal?.throwIfAborted();
    if (Date.now() >= intent.leaseUntil) throw new Error("Workspace creation was already recovered.");
    await input.adopt?.(environment);
    signal?.throwIfAborted();
    if (!(await pending.deleteIfValue(externalId, intent))) {
      if (input.adopt && !(await pending.get(externalId)))
        await releaseEnvironment(deps.store, environment.id, intent.runId);
      throw new Error("Workspace creation was already recovered.");
    }
    return environment;
  } catch (error) {
    // If the invocation has already aborted, the durable lease still lets recovery take over.
    await abandonCreation(pending, externalId).catch(() => {});
    throw error;
  }
}

async function abandonCreation(pending: ReturnType<typeof creations>, externalId: string) {
  const current = await pending.read(externalId);
  if (current && !current.value.abandoned)
    await pending.updateIfUnchanged(externalId, current.revision, { ...current.value, abandoned: true });
}

export async function isCreatingEnvironment(store: ExtensionStorageApi, environment: Environment) {
  return Boolean(environment.external_id && (await creations(store).get(environment.external_id)));
}

async function findCreatedEnvironment(deps: CreationDeps, intent: Creation, signal?: AbortSignal) {
  const query = new URLSearchParams({ external_id: intent.externalId, limit: "2" });
  const page = await deps.api<{ items: Environment[]; next_cursor: string | null }>({
    method: "GET",
    path: `/v1/workspaces?${query}`,
    signal,
  });
  const matching = page.items.filter(
    (workspace) =>
      workspace.external_id === intent.externalId &&
      workspace.metadata.pstdio_project_id === deps.projectId &&
      workspace.metadata.purpose === intent.purpose,
  );
  if (page.next_cursor || matching.length > 1) throw new Error("Workspace creation lookup was ambiguous.");
  return matching[0];
}

async function recoverCreation(deps: CreationDeps, candidate: Creation, signal?: AbortSignal) {
  const pending = creations(deps.store);
  const current = await pending.read(candidate.externalId);
  if (!current || !needsRecovery(current.value)) return false;
  const intent = { ...current.value, abandoned: true } as const;
  // Fence the launcher before making any controller call. A successful handoff removes this record.
  if (!current.value.abandoned && !(await pending.updateIfUnchanged(intent.externalId, current.revision, intent)))
    return false;
  const environment = await findCreatedEnvironment(deps, intent, signal);
  if (!environment) {
    // An aborted create can become visible after the first inventory read.
    if (Date.now() >= intent.leaseUntil + TRANSFER_ALLOWANCE_SECONDS * 1000)
      await pending.deleteIfValue(intent.externalId, intent);
    return false;
  }
  const claim = await deps.store.collection<Claim>("environment-claims").get(environment.id);
  if (!claim || (claim.runId === intent.runId && claim.setup)) {
    const observed = canCancel.includes(environment.state)
      ? await stopEnvironment(deps.api, environment.id, signal)
      : environment;
    // The controller can requeue a provisioning workspace while handling its cancel.
    if (!stoppingOrEnded.includes(observed.state)) return false;
    await releaseEnvironment(deps.store, environment.id, intent.runId);
    return pending.deleteIfValue(intent.externalId, intent);
  }
  await pending.deleteIfValue(intent.externalId, intent);
  return false;
}

export async function recoverWorkspaceCreations(
  ctx: Pick<ExtensionContextBase, "storage" | "connections" | "projectId" | "logger"> & { signal?: AbortSignal },
) {
  const api = connectionApi(ctx.connections);
  const deps = {
    api: (<T>(input: Parameters<Api>[0]) => api<T>({ ...input, timeoutMs: RECOVERY_REQUEST_TIMEOUT_MS })) satisfies Api,
    store: ctx.storage,
    projectId: ctx.projectId,
  };
  const pending = (await creations(ctx.storage).list()).filter(needsRecovery);
  let changed = false;
  for (let offset = 0; offset < pending.length; offset += RECOVERY_CONCURRENCY) {
    ctx.signal?.throwIfAborted();
    const batch = pending.slice(offset, offset + RECOVERY_CONCURRENCY);
    const results = await Promise.all(
      batch.map((intent) =>
        recoverCreation(deps, intent, ctx.signal).catch((error) => {
          ctx.logger.warn(`Could not recover workspace creation ${intent.externalId}: ${String(error)}`);
          return false;
        }),
      ),
    );
    changed ||= results.some(Boolean);
  }
  return changed;
}
