import type { ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import type { ConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionRequestService } from "./extension-connection-request-service";
import {
  type ConnectionKey,
  connectionKey,
  type ExtensionConnectionServiceDeps,
  type StoredConnection,
  toConnectionRecord,
} from "./extension-connection-service-types";
import { validateBaseUrl } from "./extension-connection-transport";

const removeProjectConnectionSecrets = async (deps: ExtensionConnectionServiceDeps, projectId: string) => {
  const configured = await deps.connectionsDBService.listByProject(projectId);
  for (const connection of configured) {
    if (connection.secret_ref) await deps.secretStore.delete(connection.secret_ref);
  }
};

const removeExtensionConnections = async (
  deps: ExtensionConnectionServiceDeps,
  projectId: string,
  extensionId: string,
) => {
  const configured = await deps.connectionsDBService.listByExtension(projectId, extensionId);
  for (const connection of configured) {
    await removeConnection(deps, {
      projectId,
      extensionId,
      connectionId: connection.contribution_id,
    });
  }
};

const resolveConfiguredSecret = async (
  deps: ExtensionConnectionServiceDeps,
  existing: StoredConnection | null,
  secret: string | undefined,
) => {
  if (secret === undefined) {
    if (!existing?.secret_ref) throw new Error("Connection credential is required.");
    return { secretRef: existing.secret_ref, newSecretRef: null };
  }
  if (!secret) throw new Error("Connection credential must not be empty.");
  const newSecretRef = await deps.secretStore.set(secret);
  return { secretRef: newSecretRef, newSecretRef };
};

const retirePreviousSecret = async (
  deps: ExtensionConnectionServiceDeps,
  key: ReturnType<typeof connectionKey>,
  existing: StoredConnection | null,
  newSecretRef: string | null,
) => {
  if (!newSecretRef || !existing?.secret_ref || existing.secret_ref === newSecretRef) return;
  try {
    await deps.secretStore.delete(existing.secret_ref);
  } catch (error) {
    await deps.connectionsDBService.upsert({
      ...key,
      baseUrl: existing.base_url,
      authType: existing.auth_type,
      authHeaderName: existing.auth_header_name,
      secretRef: existing.secret_ref,
    });
    await deps.secretStore.delete(newSecretRef);
    throw error;
  }
};

const configureConnection = async (
  deps: ExtensionConnectionServiceDeps,
  input: ConnectionKey & { baseUrl: string; secret?: string },
) => {
  const contribution = await deps.getContribution(input);
  if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
  const key = connectionKey(input);
  const existing = await deps.connectionsDBService.get(key);
  const { secretRef, newSecretRef } = await resolveConfiguredSecret(deps, existing, input.secret);
  let stored: StoredConnection;
  try {
    stored = await deps.connectionsDBService.upsert({
      ...key,
      baseUrl: validateBaseUrl(input.baseUrl),
      authType: contribution.auth.type,
      authHeaderName: contribution.auth.type === "header" ? contribution.auth.headerName : null,
      secretRef,
    });
  } catch (error) {
    if (newSecretRef) await deps.secretStore.delete(newSecretRef);
    throw error;
  }
  await retirePreviousSecret(deps, key, existing, newSecretRef);
  return toConnectionRecord(stored);
};

const removeConnection = async (deps: ExtensionConnectionServiceDeps, input: ConnectionKey) => {
  const key = connectionKey(input);
  const existing = await deps.connectionsDBService.get(key);
  if (!existing) return false;
  const secret = existing.secret_ref ? await deps.secretStore.get(existing.secret_ref) : null;
  if (existing.secret_ref) {
    if (!secret) throw new Error(`Connection credential is not configured: ${input.connectionId}`);
    await deps.secretStore.delete(existing.secret_ref);
  }
  try {
    return Boolean(await deps.connectionsDBService.remove(key));
  } catch (error) {
    if (existing.secret_ref && secret) await deps.secretStore.set(secret, existing.secret_ref);
    throw error;
  }
};

export const createExtensionConnectionService = (deps: ExtensionConnectionServiceDeps) => {
  const requestService = createExtensionConnectionRequestService(deps);
  const configure = (input: ConnectionKey & { baseUrl: string; secret?: string }) => configureConnection(deps, input);
  const list = async (projectId: string) =>
    (await deps.connectionsDBService.listByProject(projectId)).map(toConnectionRecord);
  const remove = (input: ConnectionKey) => removeConnection(deps, input);
  const removeProject = (projectId: string) => removeProjectConnectionSecrets(deps, projectId);
  const removeExtension = (projectId: string, extensionId: string) =>
    removeExtensionConnections(deps, projectId, extensionId);

  return { ...requestService, configure, list, remove, removeExtension, removeProject };
};

export const createExtensionConnectionsApi = (
  service: Pick<ReturnType<typeof createExtensionConnectionService>, "request" | "stream">,
  scope: { projectId: string; extensionId: string },
): ExtensionConnectionsApi => ({
  request: (connectionId, input) => service.request({ ...scope, connectionId, input }),
  stream: (connectionId, input) => service.stream({ ...scope, connectionId, input }),
});

export type { ConnectionSecretStore, ExtensionConnectionServiceDeps };
