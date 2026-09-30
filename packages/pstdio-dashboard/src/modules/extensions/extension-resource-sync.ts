import type { Disposable, ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { toDashboardExtensionResource } from "./extension-kanban-adapter";

interface WatchOpenExtensionResourceInput {
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: Pick<DashboardExtensionMetadata, "resourceKinds">;
  projectId: string;
}

const identityOf = (resource: ResourceRef | undefined) => (resource ? `${resource.type}:${resource.id}` : undefined);

const sameReference = (left: ResourceRef, right: ResourceRef) =>
  left.label === right.label &&
  left.icon === right.icon &&
  left.shorthand === right.shorthand &&
  JSON.stringify(left.metadata ?? {}) === JSON.stringify(right.metadata ?? {});

// A page keeps the reference captured when it opened, and a pasted link carries only the
// identity. The owning extension knows the current reference, so the host asks it again
// when another resource opens and after the extension reports a change. Replaying the
// page does not change the identity, so it never triggers another request.
export const watchOpenExtensionResource = (
  ctx: WorkbenchModuleContext,
  input: WatchOpenExtensionResourceInput,
): Disposable => {
  const resolvers = new Map(
    input.metadata.resourceKinds.flatMap((kind) =>
      kind.resolveCommand
        ? [[kind.id, { commandId: kind.resolveCommand, extensionId: kind.extensionId }] as const]
        : [],
    ),
  );
  let openIdentity: string | undefined;
  let pending: AbortController | undefined;

  const resolveOpenResource = async () => {
    pending?.abort();
    pending = undefined;
    const open = ctx.getPrimaryResource();
    const resolver = open ? resolvers.get(open.type) : undefined;
    if (!open || !resolver) return;
    const request = new AbortController();
    pending = request;
    try {
      const response = await input.executeCommand(
        input.projectId,
        resolver.commandId,
        { projectId: input.projectId, resource: open, source: "dashboard" },
        request.signal,
      );
      if (request.signal.aborted) return;
      if (response.outcome.status !== "success") throw new Error(response.outcome.reason ?? "Resolver failed.");
      const resolved = toDashboardExtensionResource(response.outcome.value, input.projectId);
      const latest = ctx.getPrimaryResource();
      if (!resolved || !latest || identityOf(resolved) !== identityOf(latest)) return;
      // The resolver describes the resource; the open page keeps its identity and route.
      const current = {
        ...latest,
        label: resolved.label,
        icon: resolved.icon,
        shorthand: resolved.shorthand,
        metadata: resolved.metadata,
      };
      if (sameReference(latest, current)) return;
      setResourceBreadcrumb(ctx, current);
    } catch (error) {
      if (request.signal.aborted) return;
      console.warn(`Could not resolve ${identityOf(open)} with ${resolver.commandId}`, error);
    }
  };

  const onPrimaryResourceChange = () => {
    const identity = identityOf(ctx.getPrimaryResource());
    if (identity === openIdentity) return;
    openIdentity = identity;
    void resolveOpenResource();
  };

  onPrimaryResourceChange();
  const primarySubscription = ctx.onDidChangePrimaryResource(onPrimaryResourceChange);
  const unsubscribeEvents = subscribeToExtensionEventFeed((event) => {
    const open = ctx.getPrimaryResource();
    const resolver = open ? resolvers.get(open.type) : undefined;
    if (event.projectId !== input.projectId || !resolver) return;
    if (event.id.startsWith(`${resolver.extensionId}.event.`)) void resolveOpenResource();
  });
  return {
    dispose() {
      pending?.abort();
      primarySubscription.dispose();
      unsubscribeEvents();
    },
  };
};
