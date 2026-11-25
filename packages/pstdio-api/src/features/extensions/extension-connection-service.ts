import type { ConfigureExtensionConnectionInput } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import type { ConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionRequestService } from "./extension-connection-request-service";
import {
  type ConnectionCleanupContext,
  type ConnectionKey,
  connectionKey,
  type ExtensionConnectionServiceDeps,
  type StoredConnection,
  toConnectionRecord,
} from "./extension-connection-service-types";
import { validateBaseUrl } from "./extension-connection-transport";

const prepareProjectConnectionRemoval = async (deps: ExtensionConnectionServiceDeps, projectId: string) => {
  const secretRefs = await deps.connectionsDBService.credentials.projectRefs(projectId);
  return async () => {
    for (const secretRef of secretRefs) await deleteSecret(deps, secretRef, "remove_project_secret");
  };
};

const reportCleanupError = (deps: ExtensionConnectionServiceDeps, error: unknown, context: ConnectionCleanupContext) =>
  Promise.resolve()
    .then(() => deps.onCleanupError?.(error, context))
    .catch(() => {});

const deleteSecret = async (deps: ExtensionConnectionServiceDeps, secretRef: string, operation: string) => {
  try {
    if (await deps.connectionsDBService.credentials.isReferenced(secretRef)) return;
    await deps.secretStore.delete(secretRef);
  } catch (error) {
    await reportCleanupError(deps, error, { operation, secretRef });
  }
};

const removeExtensionConnections = async (
  deps: ExtensionConnectionServiceDeps,
  projectId: string,
  extensionId: string,
) => {
  if (await deps.isExtensionInstalled?.(projectId, extensionId)) return;
  const configured = await deps.connectionsDBService.listByExtension(projectId, extensionId);
  for (const connection of configured) {
    try {
      await removeConnection(deps, {
        projectId,
        extensionId,
        contributionId: connection.contribution_id,
      });
    } catch (error) {
      await reportCleanupError(deps, error, { operation: "remove_extension_connection" });
    }
  }
  for (const ref of await deps.connectionsDBService.credentials.removeProjectExtension(projectId, extensionId)) {
    await deleteSecret(deps, ref, "remove_extension_credential");
  }
};

const reconcileCredentialOwners = async (
  deps: ExtensionConnectionServiceDeps,
  installed: Map<string, Promise<boolean>>,
) => {
  if (!deps.isExtensionInstalled) return;
  // User-data removal can precede host cleanup, so configurations alone cannot
  // identify scoped credentials left behind by an uninstalled extension.
  for await (const owner of deps.connectionsDBService.credentials.projectOwners()) {
    const ownerKey = JSON.stringify([owner.projectId, owner.extensionId]);
    const ownerExists = installed.get(ownerKey) ?? deps.isExtensionInstalled(owner.projectId, owner.extensionId);
    installed.set(ownerKey, ownerExists);
    try {
      if (await ownerExists) continue;
      for (const ref of await deps.connectionsDBService.credentials.removeProjectExtension(
        owner.projectId,
        owner.extensionId,
      )) {
        await deleteSecret(deps, ref, "reconcile_extension_credential");
      }
    } catch (error) {
      await reportCleanupError(deps, error, { operation: "reconcile_extension_credential" });
    }
  }
};

const reconcileConnections = async (deps: ExtensionConnectionServiceDeps) => {
  if (deps.isExtensionInstalled) {
    const configured = await deps.connectionsDBService.listAll();
    const installed = new Map<string, Promise<boolean>>();
    for (const connection of configured) {
      const ownerKey = JSON.stringify([connection.project_id, connection.extension_id]);
      const ownerExists =
        installed.get(ownerKey) ?? deps.isExtensionInstalled(connection.project_id, connection.extension_id);
      installed.set(ownerKey, ownerExists);
      try {
        if (await ownerExists) continue;
        await removeConnection(deps, {
          projectId: connection.project_id,
          extensionId: connection.extension_id,
          contributionId: connection.contribution_id,
        });
      } catch (error) {
        await reportCleanupError(deps, error, { operation: "reconcile_extension_connection" });
      }
    }
    await reconcileCredentialOwners(deps, installed);
  }

  for (const secretRef of await deps.secretStore.listRefs()) {
    await deleteSecret(deps, secretRef, "reconcile_orphan_secret");
  }
};

const resolveConfiguredSecret = async (
  deps: ExtensionConnectionServiceDeps,
  secretRef: string | undefined,
  secret: string | undefined,
) => {
  if (secret === undefined) {
    if (!secretRef) throw new Error("Connection credential is required for this provider.");
    return { secretRef, newSecretRef: null };
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
  credentialProjectId: string | null,
) => {
  if (!newSecretRef || !existing?.secret_ref || existing.secret_ref === newSecretRef) return;
  if (await deps.connectionsDBService.credentials.isReferenced(existing.secret_ref)) return;
  // A scope change can retire several credential rows. Cleanup follows committed metadata
  // and can retry; rotation within one scope retains the existing rollback contract.
  if (existing.credential_project_id !== credentialProjectId) {
    await deleteSecret(deps, existing.secret_ref, "retire_scoped_connection_secret");
    return;
  }
  try {
    await deps.secretStore.delete(existing.secret_ref);
  } catch (error) {
    await deps.connectionsDBService.upsert({
      ...key,
      baseUrl: existing.base_url,
      authType: existing.auth_type,
      authHeaderName: existing.auth_header_name,
      secretRef: existing.secret_ref,
      credentialProjectId,
    });
    if (!(await deps.connectionsDBService.credentials.isReferenced(newSecretRef)))
      await deps.secretStore.delete(newSecretRef);
    throw error;
  }
};

const retireProjectCopies = async (deps: ExtensionConnectionServiceDeps, input: ConnectionKey) => {
  const identity = { extensionId: canonicalExtensionId(input.extensionId), connectionId: input.connectionId };
  let copies: StoredConnection[];
  try {
    copies = await deps.connectionsDBService.listAll();
  } catch (error) {
    await reportCleanupError(deps, error, { ...identity, operation: "list_global_connection_copies" });
    return;
  }
  for (const copy of copies) {
    if (
      copy.project_id === null ||
      copy.extension_id !== identity.extensionId ||
      copy.contribution_id !== identity.connectionId
    )
      continue;
    const owner = { ...identity, projectId: copy.project_id };
    try {
      if ((await deps.getContribution(owner))?.scope === "global") await removeConnection(deps, connectionKey(owner));
    } catch (error) {
      await reportCleanupError(deps, error, { ...owner, operation: "remove_global_connection_copy" });
    }
  }
};

const resolveCredentialChoice = async (
  deps: ExtensionConnectionServiceDeps,
  key: ReturnType<typeof connectionKey>,
  scope: ConfigureExtensionConnectionInput["credentialScope"],
  origin: string,
) => {
  const project = await deps.connectionsDBService.credentials.get(key);
  if (scope === "project" || (scope === undefined && project))
    return { projectId: key.projectId, credential: project, retired: null };
  return {
    projectId: null,
    credential: await deps.connectionsDBService.credentials.getShared(key, origin),
    retired: project,
  };
};

const assertCredentialScope = (
  key: ReturnType<typeof connectionKey>,
  scope: ConfigureExtensionConnectionInput["credentialScope"],
) => {
  if (key.projectId === null && scope === "project")
    throw new Error("A global connection requires a shared credential.");
};

const configureConnection = async (
  deps: ExtensionConnectionServiceDeps,
  input: ConnectionKey & ConfigureExtensionConnectionInput,
) => {
  const contribution = await deps.getContribution(input);
  if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
  const key = connectionKey(input, contribution.scope);
  assertCredentialScope(key, input.credentialScope);
  const existing = await deps.connectionsDBService.get(key);
  const baseUrl = validateBaseUrl(input.baseUrl);
  const global = key.projectId === null;
  const origin = new URL(baseUrl).origin;
  const choice = global ? null : await resolveCredentialChoice(deps, key, input.credentialScope, origin);
  const credentialProjectId = choice?.projectId ?? null;
  const previous = choice?.credential;
  const previousRef = global ? existing?.secret_ref : previous?.secret_ref;
  const previousOrigin = global && existing ? new URL(existing.base_url).origin : previous?.provider;
  const usable = previousOrigin === origin && (!previous?.expires_at || Date.parse(previous.expires_at) > Date.now());
  const reusable = usable ? (previousRef ?? undefined) : undefined;
  const { secretRef, newSecretRef } = await resolveConfiguredSecret(deps, reusable, input.secret);
  let stored: StoredConnection;
  try {
    stored = await deps.connectionsDBService.upsert({
      ...key,
      baseUrl,
      authType: contribution.auth.type,
      authHeaderName: contribution.auth.type === "header" ? contribution.auth.headerName : null,
      secretRef,
      credentialProjectId,
    });
  } catch (error) {
    if (newSecretRef) await deleteSecret(deps, newSecretRef, "remove_uncommitted_connection_secret");
    throw error;
  }
  await retirePreviousSecret(deps, key, existing, newSecretRef, credentialProjectId);
  const retiring = new Set([previous?.secret_ref, choice?.retired?.secret_ref]);
  for (const ref of retiring)
    if (ref && ref !== secretRef && (!newSecretRef || ref !== existing?.secret_ref))
      await deleteSecret(deps, ref, "retire_previous_connection_secret");
  if (global) await retireProjectCopies(deps, input);
  return toConnectionRecord(stored);
};

const removeConnection = async (
  deps: ExtensionConnectionServiceDeps,
  key: ReturnType<typeof connectionKey>,
  allProjects = false,
) => {
  const removed = await deps.connectionsDBService.remove(key, allProjects);
  if (!removed) return false;
  for (const ref of new Set(removed)) await deleteSecret(deps, ref, "remove_connection_secret");
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
  const configure = (input: ConnectionKey & ConfigureExtensionConnectionInput) =>
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
  const remove = (input: ConnectionKey & { credentialScope?: "all-projects" | "project" }) =>
    mutate(async () => {
      const contribution = await deps.getContribution(input);
      if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
      const key = connectionKey(input, contribution.scope);
      assertCredentialScope(key, input.credentialScope);
      return removeConnection(deps, key, input.credentialScope === "all-projects");
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
