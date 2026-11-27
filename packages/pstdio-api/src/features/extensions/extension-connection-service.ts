import type { ConfigureExtensionConnectionInput, DeleteExtensionConnectionInput } from "pstdio-api-contracts";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionConnectionsApi } from "pstdio-api-contracts/extension-kernel";
import { createOAuthGrants } from "./connection-oauth/grants";
import { createMcpToolCaller } from "./connection-oauth/mcp";
import type { ConnectionSecretStore } from "./connection-secret-store";
import { deleteSecret, prepareProjectConnectionRemoval, reportCleanupError } from "./extension-connection-cleanup";
import { createExtensionConnectionListService } from "./extension-connection-list-service";
import { createExtensionConnectionRequestService } from "./extension-connection-request-service";
import {
  type ConnectionKey,
  connectionKey,
  type ExtensionConnectionServiceDeps,
  type StoredConnection,
  toConnectionRecord,
} from "./extension-connection-service-types";
import { ConnectionInputError, validateBaseUrl, validateSharedOrigin } from "./extension-connection-transport";

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
    throw new ConnectionInputError("A global connection requires a shared credential.");
};

const requireStaticContribution = async (deps: ExtensionConnectionServiceDeps, input: ConnectionKey) => {
  const contribution = await deps.getContribution(input);
  if (!contribution) throw new Error(`Connection is not declared: ${input.connectionId}`);
  if (contribution.auth.type === "oauth")
    throw new ConnectionInputError("Use browser authorization for OAuth connections.");
  return { scope: contribution.scope, auth: contribution.auth };
};

const configureConnection = async (
  deps: ExtensionConnectionServiceDeps,
  input: ConnectionKey & ConfigureExtensionConnectionInput,
) => {
  const contribution = await requireStaticContribution(deps, input);
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

const sharedOriginForRemoval = async (deps: ExtensionConnectionServiceDeps, key: ReturnType<typeof connectionKey>) => {
  const existing = await deps.connectionsDBService.get(key);
  if (existing) return new URL(existing.base_url).origin;
  const origins = await deps.connectionsDBService.credentials.sharedOriginCandidates(key);
  if (origins.length > 1) throw new ConnectionInputError("Choose the server origin of the sign-in to revoke.");
  return origins[0];
};

const removeConnection = async (deps: ExtensionConnectionServiceDeps, key: ReturnType<typeof connectionKey>) => {
  const removed = await deps.connectionsDBService.remove(key);
  if (!removed) return false;
  for (const ref of new Set(removed)) await deleteSecret(deps, ref, "remove_connection_secret");
  return true;
};

const revokeSharedSignIn = async (
  deps: ExtensionConnectionServiceDeps,
  key: ReturnType<typeof connectionKey>,
  origin: string | undefined,
) => {
  if (!origin) return false;
  const ref = await deps.connectionsDBService.removeSharedCredential(key, origin);
  if (!ref) return false;
  await deleteSecret(deps, ref, "revoke_shared_connection_secret");
  return true;
};

type ConnectionRemoval = ConnectionKey & DeleteExtensionConnectionInput;

const revokeSignInAtOrigin = async (deps: ExtensionConnectionServiceDeps, input: ConnectionRemoval, origin: string) => {
  // Explicit revocation uses saved credential ownership even when the extension is unavailable.
  const result = await deps.connectionsDBService.removeCredentialAtOrigin(
    connectionKey(input),
    validateSharedOrigin(origin),
    input.signInScope,
  );
  if (result.status === "ambiguous")
    throw new ConnectionInputError("This origin matches more than one saved sign-in. Set signInScope.");
  if (result.status === "wrong-origin")
    throw new ConnectionInputError("The global sign-in belongs to a different server origin.");
  if (result.status !== "removed") return false;
  await deleteSecret(deps, result.secretRef, "revoke_connection_secret_at_origin");
  return true;
};

export const createExtensionConnectionService = (input: ExtensionConnectionServiceDeps) => {
  const deps: ExtensionConnectionServiceDeps = {
    ...input,
    getContribution: (key) => input.getContribution({ ...key, extensionId: canonicalExtensionId(key.extensionId) }),
  };
  const listService = createExtensionConnectionListService(deps);
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
  const oauth = createOAuthGrants(deps, mutate);
  const requestService = createExtensionConnectionRequestService(deps, oauth);
  const callTool = createMcpToolCaller(deps, oauth);
  const configure = (input: ConnectionKey & ConfigureExtensionConnectionInput) =>
    mutate(() => configureConnection(deps, input));
  const remove = (input: ConnectionRemoval) =>
    mutate(async () => {
      if (input.origin !== undefined || input.signInScope !== undefined) {
        if (input.credentialScope !== "all-projects" || input.origin === undefined)
          throw new ConnectionInputError("Specify a server origin with all-projects revocation.");
        return revokeSignInAtOrigin(deps, input, input.origin);
      }
      const contribution = await deps.getContribution(input);
      if (!contribution)
        throw new ConnectionInputError(
          "This connection is unavailable. Provide a server origin with all-projects revocation to remove a saved sign-in.",
        );
      if (contribution.auth.type === "oauth") throw new ConnectionInputError("Use the OAuth disconnect operation.");
      const key = connectionKey(input, contribution.scope);
      assertCredentialScope(key, input.credentialScope);
      if (input.credentialScope === "all-projects" && key.projectId !== null)
        return revokeSharedSignIn(deps, key, await sharedOriginForRemoval(deps, key));
      return removeConnection(deps, key);
    });
  const reconcile = () => mutate(() => reconcileConnections(deps));
  const prepareProjectRemoval = async (projectId: string) => {
    const removeSecrets = await mutate(() => {
      oauth.cancelPending(projectId);
      return prepareProjectConnectionRemoval(deps, projectId);
    });
    return () => mutate(removeSecrets);
  };
  const removeExtension = (projectId: string, extensionId: string) =>
    mutate(() => {
      const canonical = canonicalExtensionId(extensionId);
      oauth.cancelPending(projectId, canonical);
      return removeExtensionConnections(deps, projectId, canonical);
    });

  return {
    ...requestService,
    ...listService,
    configure,
    prepareProjectRemoval,
    reconcile,
    remove,
    removeExtension,
    oauth,
    callTool,
  };
};

export const createExtensionConnectionsApi = (
  service: Pick<ReturnType<typeof createExtensionConnectionService>, "request" | "stream" | "oauth" | "callTool">,
  scope: { projectId: string; extensionId: string; oauthOwner?: () => Promise<string> },
): ExtensionConnectionsApi => ({
  oauthStatus: (connectionId) => service.oauth.status({ ...scope, connectionId }, scope.oauthOwner),
  callTool: (connectionId, input) => service.callTool({ ...scope, connectionId, input }),
  request: (connectionId, input) => service.request({ ...scope, connectionId, input }),
  stream: (connectionId, input) => service.stream({ ...scope, connectionId, input }),
});

export type { ConnectionSecretStore, ExtensionConnectionServiceDeps };
