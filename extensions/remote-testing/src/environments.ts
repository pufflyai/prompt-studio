import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { Api } from "./connection";
import type { Settings } from "./settings";

// A test environment is one PocketCoder workspace of the configured template.
export interface Environment {
  id: string;
  external_id: string;
  state: string;
  reason_code: string | null;
  change_cursor: number;
  created_at: string;
  deadline_at: string | null;
  template: { name: string; version: string };
  metadata: Record<string, string>;
  failure: { log_tail: string } | null;
}

const PURPOSE = "remote-testing";
const MANAGED_PURPOSES = [PURPOSE, "pstdio-preview"];
const ACTIVE = ["queued", "provisioning", "connected", "ready"];
const ENDED = ["succeeded", "failed", "canceled", "expired", "preserved"];
const path = (id: string) => `/v1/workspaces/${encodeURIComponent(id)}`;

export async function listEnvironments(api: Api, projectId: string) {
  const environments: Environment[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page: { items: Environment[]; next_cursor: string | null } = await api({
      method: "GET",
      path: `/v1/workspaces?${query}`,
    });
    environments.push(
      ...page.items.filter(
        (item) =>
          ACTIVE.includes(item.state) &&
          MANAGED_PURPOSES.includes(item.metadata?.purpose ?? "") &&
          item.metadata.pstdio_project_id === projectId,
      ),
    );
    cursor = page.next_cursor;
  } while (cursor);
  return environments;
}

export async function createEnvironment(
  api: Api,
  settings: Settings,
  signal?: AbortSignal,
  metadata: Record<string, string> = {},
) {
  const purpose = metadata.purpose ?? PURPOSE;
  const externalId = `${purpose}-${crypto.randomUUID()}`;
  return api<Environment>({
    method: "POST",
    path: "/v1/workspaces",
    headers: { "Idempotency-Key": externalId },
    body: {
      external_id: externalId,
      template: { name: settings.templateName, version: settings.templateVersion },
      metadata: { ...metadata, purpose },
    },
    signal,
  });
}

export async function readEnvironment(api: Api, id: string, signal?: AbortSignal) {
  return api<Environment>({ method: "GET", path: path(id), signal });
}

export async function waitUntilReady(api: Api, environment: Environment, signal?: AbortSignal) {
  let current = environment;
  while (current.state !== "ready") {
    // A stopping environment reports its failure only once it has ended.
    if (ENDED.includes(current.state))
      throw new Error(
        `Environment ${current.id} is ${current.state}${current.reason_code ? ` (${current.reason_code})` : ""}. ${current.failure?.log_tail ?? ""}`.trim(),
      );
    signal?.throwIfAborted();
    const change = await api<{ workspace: Environment }>({
      method: "GET",
      path: `${path(current.id)}/changes?after=${current.change_cursor}&wait=30`,
      timeoutMs: 40_000,
      signal,
    });
    current = change.workspace;
  }
  return current;
}

export async function stopEnvironment(api: Api, id: string, signal?: AbortSignal) {
  return api<Environment>({ method: "POST", path: `${path(id)}/cancel`, signal });
}

export type Claim = { runId: string; setup?: { until: number; stop: boolean; environmentId: string } };

// Ownership ends through collection or cleanup, never through elapsed wall time.
export async function claimEnvironment(
  store: ExtensionStorageApi,
  id: string,
  runId: string,
  setup?: Omit<NonNullable<Claim["setup"]>, "environmentId">,
) {
  const claims = store.collection<Claim>("environment-claims");
  const current = await claims.get(id);
  if (current) return current.runId === runId;
  return claims.createIfAbsent(id, { runId, ...(setup ? { setup: { ...setup, environmentId: id } } : {}) });
}

export async function releaseEnvironment(store: ExtensionStorageApi, id: string, runId: string) {
  const claims = store.collection<Claim>("environment-claims");
  while (true) {
    const current = await claims.get(id);
    if (current?.runId !== runId) return;
    if (await claims.deleteIfValue(id, current)) return;
  }
}

export async function ownsEnvironment(store: ExtensionStorageApi, id: string, runId: string) {
  return (await activeRun(store, id)) === runId;
}

export async function activeRun(store: ExtensionStorageApi, id: string) {
  const claim = await store.collection<Claim>("environment-claims").get(id);
  return claim?.runId ?? null;
}

export async function isBusy(store: ExtensionStorageApi, id: string) {
  return Boolean(await activeRun(store, id));
}
