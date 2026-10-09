import type { ResourceRef } from "@pstdio/sdk/extensions";
import { type WorkbenchModuleContribution, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { RelatedResources } from "./related-resources";
import { closeResourceLinksOnProjectChange } from "./resource-links-project-scope";
import type { ResourceLinksService } from "./resource-links-types";

export interface WorkbenchResourceLinksOptions {
  canonicalize(resource: ResourceRef): ResourceRef | undefined;
  createService(resource: ResourceRef): ResourceLinksService;
}

export const resourceLinksCommandId = "workbench.resources.links";
const viewId = "workbench.resources.related";

export const createWorkbenchResourceLinksModule = (options: WorkbenchResourceLinksOptions) =>
  ({
    id: "workbench.resource-links",
    activate(ctx) {
      const currentResource = () => {
        const resource = ctx.getActiveResource() ?? ctx.getPrimaryResource();
        return resource && options.canonicalize(resource);
      };
      ctx.views.registerView({
        id: viewId,
        title: "Related resources",
        body: {
          kind: "react",
          render: (input) => {
            const resource = input.instance.resource;
            return resource ? (
              <RelatedResources
                key={`${resource.projectId}:${resource.extensionId}:${resource.type}:${resource.id}`}
                resource={resource}
                service={options.createService(resource)}
                onClose={() => ctx.overlays.closeOverlay(input.instance.instanceId)}
              />
            ) : null;
          },
        },
      });
      ctx.overlays.registerOverlay({
        id: viewId,
        viewId,
        config: { size: "md", placement: "center", scrollBehavior: "inside" },
      });
      ctx.commands.registerCommand(
        { id: resourceLinksCommandId, label: "Related resources", icon: "link", category: "Resources" },
        {
          isEnabled: () => Boolean(currentResource()),
          isVisible: () => Boolean(currentResource()),
          execute: (_args, context) => {
            const current = context?.resource ?? ctx.getActiveResource() ?? ctx.getPrimaryResource();
            const resource = current && options.canonicalize(current);
            if (resource) ctx.overlays.openOverlay(viewId, { resource, title: "Related resources" });
          },
        },
      );
      // This is shared workbench chrome. Owner-only resource menu slots stay private.
      ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
        commandId: resourceLinksCommandId,
        group: "primary",
        order: 90,
      });
      return closeResourceLinksOnProjectChange(ctx, viewId);
    },
  }) satisfies WorkbenchModuleContribution;
