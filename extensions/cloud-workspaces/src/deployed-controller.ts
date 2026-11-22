import {
  defineConnection,
  type ExtensionConnectionRequest,
  type ExtensionConnectionsApi,
  l10n,
} from "@pstdio/sdk/extensions";
import { type ControllerMachine, machinePath } from "./machines";

export const deployedConnection = defineConnection({
  id: "deployed-controller",
  scope: "global",
  label: l10n("cloud-workspaces.deployed-pocketcoder-controller", "Deployed PocketCoder controller"),
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/templates", "/v1/workspaces"],
  check: { method: "GET", path: "/v1/templates?limit=1" },
});

export const deployedSettings = {
  previewBridgePath: {
    type: "string",
    title: l10n("cloud-workspaces.preview-helper.title", "Preview URL helper"),
    scope: "device",
    default: "",
    description: l10n(
      "cloud-workspaces.preview-helper.description",
      "Operator-managed TypeScript helper on this device that returns an expiring HTTPS preview URL.",
    ),
  },
  deployedName: {
    type: "string",
    title: l10n("cloud-workspaces.deployed-instance-name", "Deployed instance name"),
    scope: "project",
    default: "Deployed PocketCoder",
  },
} as const;

export function deployedName(settings: Record<string, unknown>) {
  const name = settings.deployedName;
  return (typeof name === "string" && name.trim()) || deployedSettings.deployedName.default;
}

type Connections = Pick<ExtensionConnectionsApi, "request">;
type Page<T> = { items: T[]; next_cursor: string | null };

async function requestDeployed<T>(connections: Connections, request: ExtensionConnectionRequest) {
  const { body, status } = await connections.request<T>(deployedConnection.id, { timeoutMs: 5_000, ...request });
  if (status === 401) throw new Error("Update the deployed controller credential in Cloud Workspaces settings.");
  if (status === 403) {
    if (request.method === "GET") throw new Error("The deployed controller credential lacks permission for this view.");
    if (request.path.endsWith("/cancel"))
      throw new Error("Stopping a deployed workspace requires a controller key with workspaces:cancel permission.");
    throw new Error("Launching a deployed workspace requires workspaces:create and access to its template.");
  }
  if (status < 200 || status >= 300) {
    const message = typeof body === "object" && body !== null && "message" in body ? body.message : undefined;
    throw new Error(typeof message === "string" ? message : `The deployed controller returned HTTP ${status}.`);
  }
  return body;
}

export const getDeployed = <T>(connections: Connections, path: string, signal?: AbortSignal) =>
  requestDeployed<T>(connections, { method: "GET", path, signal });

export const cancelDeployedWorkspace = (connections: Connections, id: string, signal?: AbortSignal) =>
  requestDeployed<ControllerMachine>(connections, { method: "POST", path: `${machinePath(id)}/cancel`, signal });

export const createDeployedWorkspace = (
  connections: Connections,
  input: { name: string; version: string; externalId: string },
  signal?: AbortSignal,
) =>
  requestDeployed<ControllerMachine>(connections, {
    method: "POST",
    path: "/v1/workspaces",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: {
      external_id: input.externalId,
      template: { name: input.name, version: input.version },
      metadata: { purpose: "pocketcoder-lab" },
    },
    signal,
  });

export async function* deployedItems<T>(connections: Connections, path: string) {
  const query = new URLSearchParams({ limit: "100" });
  let cursor: string | null;
  do {
    const page = await getDeployed<Page<T>>(connections, `${path}?${query}`);
    yield* page.items;
    cursor = page.next_cursor;
    if (cursor) query.set("cursor", cursor);
  } while (cursor);
}

export async function listDeployed<T>(connections: Connections, path: string) {
  const items: T[] = [];
  for await (const item of deployedItems<T>(connections, path)) items.push(item);
  return items;
}

export async function deployedStatus(connections: Connections) {
  try {
    await getDeployed(connections, deployedConnection.check.path);
    return { state: "Connected", error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("is not configured:")) {
      return { state: "Setup required", error: "Set the deployed controller connection in Cloud Workspaces settings." };
    }
    return { state: "Unavailable", error: message };
  }
}
