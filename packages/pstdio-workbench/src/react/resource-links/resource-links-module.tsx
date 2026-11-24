import type { ResourceRef } from "@pstdio/sdk/extensions";
import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "../../core";
import { registerRelatedResourcePreviews } from "./related-resource-previews";
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
      const previews = registerRelatedResourcePreviews(ctx, options);
      const currentResource = (requested?: ResourceRef) => {
        const resource = requested ?? ctx.getActiveResource() ?? ctx.getPrimaryResource();
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
          isEnabled: (args) => Boolean(currentResource((args as { resource?: ResourceRef } | undefined)?.resource)),
          isVisible: () => Boolean(currentResource()),
          execute: (args, context) => {
            const input = args as { source?: string; resource?: ResourceRef } | undefined;
            const fromActive = input?.source === "active-resource";
            const current =
              input?.resource ??
              (fromActive ? undefined : context?.resource) ??
              ctx.getActiveResource() ??
              ctx.getPrimaryResource();
            const resource = current && options.canonicalize(current);
            if (resource) ctx.overlays.openOverlay(viewId, { resource, title: "Related resources" });
          },
        },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: resourceLinksCommandId,
        args: { source: "active-resource" },
        group: "Resources",
      });
      return [previews, closeResourceLinksOnProjectChange(ctx, viewId)];
    },
  }) satisfies WorkbenchModuleContribution;
