import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  type createWorkbenchExtensionChatRendererOwners,
  type createWorkbenchExtensionTerminalRendererOwners,
  reconcileBridgeWebviewHostEventPublishers,
} from "@pstdio/workbench/extensions";
import { getRuntimeCollections } from "@/lib/sync/collections";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { omitExtensionMetadata, registerHealthyExtensions } from "./extension-contribution-isolation";
import { disposeExtensionContributions, registerExtensionContributions } from "./extension-contribution-registration";
import { independentExtensionAdditions } from "./independent-extension-additions";

const extensionContributionModuleId = "dashboard.extensions.contributions";

export const createExtensionContributionReplacement = (input: {
  owner?: ReturnType<typeof getRuntimeCollections>;
  ctx: WorkbenchModuleContext;
  chatRendererOwners: ReturnType<typeof createWorkbenchExtensionChatRendererOwners>;
  terminalRendererOwners: ReturnType<typeof createWorkbenchExtensionTerminalRendererOwners>;
  executeCommand: ExecuteDashboardExtensionCommand;
  registrationError(projectId: string, error: unknown, extensionId?: string): void;
}) => {
  const owner = input.owner ?? getRuntimeCollections();
  const { ctx, chatRendererOwners, terminalRendererOwners, executeCommand, registrationError } = input;
  let registered:
    | { projectId: string; locale: string; authority: object; metadata: ResolvedWorkbenchExtensionMetadata }
    | undefined;
  let registrations: Disposable[] = [];
  const clear = () => {
    registered = undefined;
    const previous = registrations;
    registrations = [];
    disposeExtensionContributions(previous);
  };
  let revision = 0;
  // Returns what is registered now; a failed extension is left out so the next refresh retries it.
  const replace = (
    nextProjectId: string,
    nextMetadata: ResolvedWorkbenchExtensionMetadata,
    locale: string,
    authority: object,
  ) => {
    const addition =
      registered?.projectId === nextProjectId && registered.locale === locale && registered.authority === authority
        ? independentExtensionAdditions(registered.metadata, nextMetadata)
        : undefined;
    chatRendererOwners.reconcile(nextProjectId, nextMetadata);
    terminalRendererOwners.reconcile(nextProjectId, nextMetadata);
    return chatRendererOwners.replaceRegistrations(() => {
      if (!addition) clear();
      try {
        const registration = registerHealthyExtensions({
          metadata: addition?.metadata ?? nextMetadata,
          register: (metadata) =>
            ctx.registerChildModule({
              id: `${extensionContributionModuleId}.${++revision}`,
              ownerId: "dashboard.extensions",
              source: "extension",
              activate: (contributionCtx) =>
                registerExtensionContributions({
                  owner,
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
        if (registration.metadata.extensions.length) registrations.push(registration.disposable);
        else registration.disposable.dispose();
        const accepted = addition
          ? omitExtensionMetadata(
              nextMetadata,
              new Set(
                [...addition.added].filter(
                  (id) => !registration.metadata.extensions.some((extension) => extension.id === id),
                ),
              ),
            )
          : registration.metadata;
        registered = { projectId: nextProjectId, locale, authority, metadata: accepted };
        chatRendererOwners.reconcile(nextProjectId, accepted);
        terminalRendererOwners.reconcile(nextProjectId, accepted);
        reconcileBridgeWebviewHostEventPublishers(
          ctx,
          nextProjectId,
          new Set(accepted.views.filter((view) => view.body.kind === "webview").map((view) => view.id)),
        );
        return { metadata: accepted, displaced: !addition };
      } catch (error) {
        registrationError(nextProjectId, error);
        if (addition && registered) return { metadata: registered.metadata, displaced: false };
        registered = undefined;
        chatRendererOwners.dispose();
        terminalRendererOwners.reconcile(nextProjectId, emptyDashboardExtensionMetadata);
        reconcileBridgeWebviewHostEventPublishers(ctx, nextProjectId, new Set());
        return {
          metadata: omitExtensionMetadata(
            nextMetadata,
            new Set(nextMetadata.extensions.map((extension) => extension.id)),
          ),
          displaced: true,
        };
      }
    });
  };
  return { replace, dispose: clear };
};
