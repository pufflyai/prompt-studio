import { relatedResourceOpeningSchema } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { unwrapCommandValue } from "./command-response";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

export const registerResourceKinds = (input: InternalRegisterWorkbenchExtensionContributionsInput) =>
  input.metadata.resourceKinds.map((kind) =>
    input.workbench.resources.registerKind({
      kind: kind.id,
      extensionId: kind.extensionId,
      label: text(kind.label, kind.id),
      icon: kind.icon ?? "FileText",
      relatedOpenings: kind.relatedOpeningsCommand
        ? async (resource, signal) => {
            const response = await input.executeCommand(
              kind.relatedOpeningsCommand!,
              { projectId: input.projectId, resource, source: "dashboard" },
              signal,
            );
            signal.throwIfAborted();
            // Selection commands return data. Their navigation requests cannot steal source focus.
            const openings = relatedResourceOpeningSchema.array().parse(unwrapCommandValue(response));
            return openings.map((opening) => ({
              ...opening,
              resource: {
                ...opening.resource,
                projectId: opening.resource.projectId ?? input.projectId,
                extensionId: opening.resource.extensionId ?? kind.extensionId,
              },
            }));
          }
        : undefined,
    }),
  );
