import type { ConnectionCleanupContext, ExtensionConnectionServiceDeps } from "./extension-connection-service-types";

export const reportCleanupError = (
  deps: ExtensionConnectionServiceDeps,
  error: unknown,
  context: ConnectionCleanupContext,
) =>
  Promise.resolve()
    .then(() => deps.onCleanupError?.(error, context))
    .catch(() => {});

export const deleteSecret = async (deps: ExtensionConnectionServiceDeps, secretRef: string, operation: string) => {
  try {
    if (await deps.connectionsDBService.credentials.isReferenced(secretRef)) return;
    await deps.secretStore.delete(secretRef);
  } catch (error) {
    await reportCleanupError(deps, error, { operation, secretRef });
  }
};

export const prepareProjectConnectionRemoval = async (deps: ExtensionConnectionServiceDeps, projectId: string) => {
  const secretRefs = await deps.connectionsDBService.credentials.projectRefs(projectId);
  return async () => {
    for (const secretRef of secretRefs) await deleteSecret(deps, secretRef, "remove_project_secret");
  };
};
