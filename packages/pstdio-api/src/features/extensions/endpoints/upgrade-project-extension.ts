import { createRoute, z } from "@hono/zod-openapi";
import { upgradeProjectExtensionResponseSchema } from "pstdio-api-contracts";
import { createExtensionUpgradePool } from "pstdio-api-contracts/extension-host";
import { extensionUpgradeConcurrency } from "pstdio-extensions/preparation-client";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-unavailable-error";
import type { AppRouteHandler } from "../../../types";
import { scheduleProjectWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "../deps";
import { extensionChangesWorkspaceProvisioning } from "../extension-skill-cleanup";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const upgradeProjectExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/upgrade",
  description: "Replace a release-managed extension with the source paired with this Prompt Studio release.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Extension source after the upgrade attempt.",
      content: { "application/json": { schema: upgradeProjectExtensionResponseSchema } },
    },
    400: {
      description: "Release source failed to install or validate.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension source cannot be upgraded by this host.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const upgradeInstance = async (
  deps: ExtensionsRouteDeps,
  service: NonNullable<ExtensionsRouteDeps["extensionUpgradeService"]>,
  projectId: string,
  instanceId: string,
) => {
  const before = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
  if (!before) return null;
  const hadWorkspaceContributions =
    before.instance.enabled && (await extensionChangesWorkspaceProvisioning(deps, before.installedSource));
  const result = await service.upgrade(projectId, instanceId);
  if (!result) return null;
  // A toggle or uninstall may have completed while preparing the source.
  const current = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
  if (!current) return null;
  if (result.changed && current.instance.enabled) {
    const needsWorkspaceRefresh =
      !before.instance.enabled ||
      hadWorkspaceContributions ||
      (await extensionChangesWorkspaceProvisioning(deps, current.installedSource));
    if (needsWorkspaceRefresh) scheduleProjectWorkspaceProvisioning(deps, projectId);
  }
  return {
    changed: result.changed,
    extension: toProjectExtensionInstance(current.instance, current.installedSource, undefined, {
      canUpgrade:
        // Registration confirms the release actually installed. A later inventory read checks for newer releases.
        current.installedSource.id === result.installedSource.id &&
        current.installedSource.source_hash === result.installedSource.source_hash &&
        current.installedSource.source_ref === result.installedSource.source_ref
          ? false
          : await service.canUpgrade(current.installedSource),
    }),
  };
};

export const upgradeProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof upgradeProjectExtensionRoute> => {
  const runUpgrade = createExtensionUpgradePool(extensionUpgradeConcurrency);
  const inFlight = new Map<string, ReturnType<typeof upgradeInstance>>();
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const service = deps.extensionUpgradeService;
    if (!service) return c.json({ error: "This Prompt Studio host does not support extension upgrades." }, 409);
    const key = JSON.stringify([projectId, instanceId]);
    try {
      let pending = inFlight.get(key);
      if (!pending) {
        pending = runUpgrade(() => upgradeInstance(deps, service, projectId, instanceId)).finally(() =>
          inFlight.delete(key),
        );
        inFlight.set(key, pending);
      }
      const result = await pending;
      if (!result) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
      return c.json(result, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ExtensionUpgradeUnavailableError) return c.json({ error: message }, 409);
      return c.json({ error: message }, 400);
    }
  };
};
