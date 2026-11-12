import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  type createWorkbenchExtensionChatRendererOwners,
  type createWorkbenchExtensionTerminalRendererOwners,
  reconcileBridgeWebviewHostEventPublishers,
} from "@pstdio/workbench/extensions";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { omitExtensionMetadata, registerHealthyExtensions } from "./extension-contribution-isolation";
import { registerExtensionContributions } from "./extension-contribution-registration";

const extensionContributionModuleId = "dashboard.extensions.contributions";

export const createExtensionContributionReplacement = (input: {
  ctx: WorkbenchModuleContext;
  chatRendererOwners: ReturnType<typeof createWorkbenchExtensionChatRendererOwners>;
  terminalRendererOwners: ReturnType<typeof createWorkbenchExtensionTerminalRendererOwners>;
  executeCommand: ExecuteDashboardExtensionCommand;
  clear(): void;
  accept(disposable: Disposable): void;
  registrationError(projectId: string, error: unknown, extensionId?: string): void;
}) => {
  const { ctx, chatRendererOwners, terminalRendererOwners, executeCommand, clear, accept, registrationError } = input;
  // Returns what is registered now; a failed extension is left out so the next refresh retries it.
  return (nextProjectId: string, nextMetadata: ResolvedWorkbenchExtensionMetadata) => {
    chatRendererOwners.reconcile(nextProjectId, nextMetadata);
    terminalRendererOwners.reconcile(nextProjectId, nextMetadata);
    return chatRendererOwners.replaceRegistrations(() => {
      clear();
      try {
        const registration = registerHealthyExtensions({
          metadata: nextMetadata,
          register: (metadata) =>
            ctx.registerChildModule({
              id: extensionContributionModuleId,
              ownerId: "dashboard.extensions",
              source: "extension",
              activate: (contributionCtx) =>
                registerExtensionContributions({
                  ctx: contributionCtx,
                  chatRendererOwners,
                  terminalRendererOwners,
                  executeCommand,
                  metadata,
                  projectId: nextProjectId,
                }),
            }),
          onFailure: (extensionId, error) => registrationError(nextProjectId, error, extensionId),
        });
        accept(registration.disposable);
        chatRendererOwners.reconcile(nextProjectId, registration.metadata);
        terminalRendererOwners.reconcile(nextProjectId, registration.metadata);
        reconcileBridgeWebviewHostEventPublishers(
          ctx,
          nextProjectId,
          new Set(registration.metadata.views.filter((view) => view.body.kind === "webview").map((view) => view.id)),
        );
        return registration.metadata;
      } catch (error) {
        registrationError(nextProjectId, error);
        chatRendererOwners.dispose();
        terminalRendererOwners.reconcile(nextProjectId, emptyDashboardExtensionMetadata);
        reconcileBridgeWebviewHostEventPublishers(ctx, nextProjectId, new Set());
        return omitExtensionMetadata(nextMetadata, new Set(nextMetadata.extensions.map((extension) => extension.id)));
      }
    });
  };
};
