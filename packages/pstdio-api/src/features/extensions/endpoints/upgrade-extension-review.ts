import { createRoute, z } from "@hono/zod-openapi";
import {
  extensionUpgradeReviewRequestSchema,
  extensionUpgradeReviewResponseSchema,
  staleExtensionUpgradeReviewDetailsSchema,
} from "pstdio-api-contracts";
import { extensionUpgradeNeedsReviewCode } from "pstdio-api-contracts/extension-host";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-unavailable-error";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { ExtensionUpgradeNeedsReviewError } from "../extension-upgrade-baseline";
import { StaleExtensionUpgradeReview } from "../review-extension-working-copy";
import { extensionUpgradeErrorSchema, upgradeInstance } from "./upgrade-project-extension";

const errorContent = { "application/json": { schema: extensionUpgradeErrorSchema } };
const conflictContent = {
  "application/json": {
    schema: extensionUpgradeErrorSchema.extend({ details: staleExtensionUpgradeReviewDetailsSchema.optional() }),
  },
};

export const upgradeExtensionReviewRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/upgrade-review",
  description: "Stage, inspect, refresh, cancel, or explicitly apply an extension upgrade review on this device.",
  tags: ["Extensions"],
  request: {
    params: z.strictObject({ projectId: z.string(), instanceId: z.string() }),
    body: { required: true, content: { "application/json": { schema: extensionUpgradeReviewRequestSchema } } },
  },
  responses: {
    200: {
      description: "Extension upgrade review operation result.",
      content: { "application/json": { schema: extensionUpgradeReviewResponseSchema } },
    },
    400: { description: "The proposed upgrade could not be validated.", content: errorContent },
    404: { description: "The extension, review, or change was not found.", content: errorContent },
    409: { description: "The extension upgrade needs review.", content: conflictContent },
  },
});

export const upgradeExtensionReviewHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof upgradeExtensionReviewRoute> =>
  async (c) => {
    const service = deps.extensionUpgradeService;
    if (!service) return c.json({ error: "Extension upgrade reviews are unavailable on this host." }, 409);
    const { projectId, instanceId } = c.req.valid("param");
    const input = c.req.valid("json");
    const response = await runReview(deps, service, projectId, instanceId, input).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof StaleExtensionUpgradeReview)
        return {
          error: message,
          code: extensionUpgradeNeedsReviewCode,
          status: 409,
          details: { changedPaths: error.changedPaths },
        } as const;
      if (error instanceof ExtensionUpgradeNeedsReviewError)
        return { error: message, code: extensionUpgradeNeedsReviewCode, status: 409 } as const;
      if (error instanceof ExtensionUpgradeUnavailableError) return { error: message, status: 409 } as const;
      return { error: message, status: 400 } as const;
    });
    if (!response) return c.json({ error: "Extension upgrade review or file was not found." }, 404);
    if ("error" in response) {
      const { status, ...body } = response;
      return status === 409 ? c.json(body, 409) : c.json(body, 400);
    }
    return c.json(response, 200);
  };

const runReview = async (
  deps: ExtensionsRouteDeps,
  service: NonNullable<ExtensionsRouteDeps["extensionUpgradeService"]>,
  projectId: string,
  instanceId: string,
  input: z.infer<typeof extensionUpgradeReviewRequestSchema>,
): Promise<z.infer<typeof extensionUpgradeReviewResponseSchema> | null> => {
  const { action } = input;
  const api = service.reviews;
  switch (action) {
    case "begin": {
      const review = await api.beginReview(projectId, instanceId);
      return review && { action, review };
    }
    case "read": {
      const review = await api.readReview(projectId, instanceId, input.id);
      return review && { action, review };
    }
    case "file": {
      const file = await api.readReviewFile(projectId, instanceId, input.id, input.path, input.revision);
      return file && { action, file };
    }
    case "refresh": {
      const review = await api.refreshReview(projectId, instanceId, input.id, input.revision, input.resolutions);
      return review && { action, review };
    }
    case "save": {
      const review = await api.saveReview(projectId, instanceId, input.id, input.revision, input.resolutions);
      return review && { action, review };
    }
    case "validate": {
      const result = await api.validateReview(projectId, instanceId, input.id, input.revision, input.resolutions);
      return result && { action, ...result };
    }
    case "cancel":
      return (await api.cancelReview(projectId, instanceId, input.id)) ? { action } : null;
    case "apply": {
      const upgrade = await upgradeInstance(deps, service, projectId, instanceId, () =>
        api.applyReview(projectId, instanceId, input.id, input.resolutions, {
          usePublished: input.usePublished,
          revision: input.revision,
        }),
      );
      return upgrade && { action, upgrade };
    }
  }
};
