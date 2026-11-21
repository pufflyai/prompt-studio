import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
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

const prepareProjectConnectionRemoval = async (deps: ExtensionConnectionServiceDeps, projectId: string) => {
  const configured = await deps.connectionsDBService.listByProject(projectId);
  const secretRefs = configured.flatMap((connection) => (connection.secret_ref ? [connection.secret_ref] : []));
  return async () => {
    for (const secretRef of secretRefs) await deleteSecret(deps, secretRef, "remove_project_secret");
  };
};

const reportCleanupError = (
  deps: ExtensionConnectionServiceDeps,
  error: unknown,
  context: { operation: string; secretRef?: string },
) => {
  deps.onCleanupError?.(error, context);
};

const deleteSecret = async (deps: ExtensionConnectionServiceDeps, secretRef: string, operation: string) => {
  try {
    await deps.secretStore.delete(secretRef);
  } catch (error) {
    reportCleanupError(deps, error, { operation, secretRef });
  }
};

const removeExtensionConnections = async (
  deps: ExtensionConnectionServiceDeps,
  projectId: string,
  extensionId: string,
) => {
  const configured = await deps.connectionsDBService.listByExtension(projectId, extensionId);
  for (const connection of configured) {
    try {
      await removeStoredConnection(deps, { projectId, extensionId, contributionId: connection.contribution_id });
    } catch (error) {
      reportCleanupError(deps, error, { operation: "remove_extension_connection" });
    }
  }
};

const reconcileConnections = async (deps: ExtensionConnectionServiceDeps) => {
  if (deps.isExtensionInstalled) {
    const configured = await deps.connectionsDBService.listAll();
    const installed = new Map<string, Promise<boolean>>();
    for (const connection of configured) {
      const ownerKey = `${connection.project_id}\0${connection.extension_id}`;
      const ownerExists =
        installed.get(ownerKey) ?? deps.isExtensionInstalled(connection.project_id, connection.extension_id);
      installed.set(ownerKey, ownerExists);
      try {
        if (await ownerExists) continue;
        await removeStoredConnection(deps, {
          projectId: connection.project_id,
          extensionId: connection.extension_id,
          contributionId: connection.contribution_id,
        });
      } catch (error) {
        reportCleanupError(deps, error, { operation: "reconcile_extension_connection" });
      }
    }
  }

  const referenced = new Set(
    (await deps.connectionsDBService.listAll()).flatMap((connection) =>
      connection.secret_ref ? [connection.secret_ref] : [],
    ),
  );
  for (const secretRef of await deps.secretStore.listRefs()) {
    if (!referenced.has(secretRef)) await deleteSecret(deps, secretRef, "reconcile_orphan_secret");
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
  const key = connectionKey(input, contribution.scope);
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
  if (contribution.scope === "global") {
    const copies = (await deps.connectionsDBService.listAll()).filter(
      (row) =>
        row.project_id !== null &&
        row.extension_id === canonicalExtensionId(input.extensionId) &&
        row.contribution_id === input.connectionId,
    );
    for (const copy of copies) {
      if (copy.project_id === null) continue;
      const owner = await deps.getContribution({
        projectId: copy.project_id,
        extensionId: copy.extension_id,
        connectionId: copy.contribution_id,
      });
      if (owner?.scope !== "global") continue;
      await removeStoredConnection(deps, {
        projectId: copy.project_id,
        extensionId: copy.extension_id,
        contributionId: copy.contribution_id,
      });
    }
  }
  return toConnectionRecord(stored);
};

const removeStoredConnection = async (deps: ExtensionConnectionServiceDeps, key: ReturnType<typeof connectionKey>) => {
  const existing = await deps.connectionsDBService.get(key);
  if (!existing) return false;
  const removed = await deps.connectionsDBService.remove(key);
  if (!removed) return false;
  if (existing.secret_ref) await deleteSecret(deps, existing.secret_ref, "remove_connection_secret");
  return true;
};

export const createExtensionConnectionService = (input: ExtensionConnectionServiceDeps) => {
  const deps: ExtensionConnectionServiceDeps = {
    ...input,
    getContribution: (key) => input.getContribution({ ...key, extensionId: canonicalExtensionId(key.extensionId) }),
  };
  const requestService = createExtensionConnectionRequestService(deps);
  // Cleanup compares database references with secret files. Keep that comparison
  // ordered with credential writes now that startup cleanup runs beside requests.
  let mutations = Promise.resolve();
  const mutate = <T>(operation: () => Promise<T>) => {
    const result = mutations.then(operation);
    mutations = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const configure = (input: ConnectionKey & { baseUrl: string; secret?: string }) =>
    mutate(() => configureConnection(deps, input));
  const list = async (projectId: string) => {
    const rows = [
      ...(await deps.connectionsDBService.listByProject(projectId)),
      ...(await deps.connectionsDBService.listGlobal()),
    ];
    const visible = await Promise.all(
      rows.map(async (row) => {
        const definition = await deps.getContribution({
          projectId,
          extensionId: row.extension_id,
          connectionId: row.contribution_id,
        });
        if (!definition || (definition.scope === "global") !== (row.project_id === null)) return null;
        return toConnectionRecord(row);
      }),
    );
    return visible.filter((row) => row !== null);
  };
  const remove = (input: ConnectionKey) =>
    mutate(async () => {
      const contribution = await deps.getContribution(input);
      if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
      return removeStoredConnection(deps, connectionKey(input, contribution.scope));
    });
  const reconcile = () => mutate(() => reconcileConnections(deps));
  const prepareProjectRemoval = async (projectId: string) => {
    const removeSecrets = await mutate(() => prepareProjectConnectionRemoval(deps, projectId));
    return () => mutate(removeSecrets);
  };
  const removeExtension = (projectId: string, extensionId: string) =>
    mutate(() => removeExtensionConnections(deps, projectId, canonicalExtensionId(extensionId)));

  return { ...requestService, configure, list, prepareProjectRemoval, reconcile, remove, removeExtension };
};

export const createExtensionConnectionsApi = (
  service: Pick<ReturnType<typeof createExtensionConnectionService>, "request" | "stream">,
  scope: { projectId: string; extensionId: string },
): ExtensionConnectionsApi => ({
  request: (connectionId, input) => service.request({ ...scope, connectionId, input }),
  stream: (connectionId, input) => service.stream({ ...scope, connectionId, input }),
});

export type { ConnectionSecretStore, ExtensionConnectionServiceDeps };
