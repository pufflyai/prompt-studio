import type { RegisteredResourceKind, ResourceRef, WorkbenchCoreContributionContext } from "../../core";
import { resourceContextMenuPath } from "../../core";
import type { ResolveMenuEntriesInput } from "./menu-entries";

// Resolves the current resource and its context menu once, so native cards and
// webviews list the same actions for the same resource.
export const resolveResourceActionMenu = (
  workbench: WorkbenchCoreContributionContext,
  subject: ResourceRef,
  onRequestParams?: ResolveMenuEntriesInput["onRequestParams"],
) => {
  const kind = workbench.resources.getKind(subject.type, subject.extensionId);
  const current = kind?.resolve ? kind.resolve(subject) : subject;
  const resource = current ? workbench.resources.preview.resolve(current) : undefined;
  if (!resource) return undefined;
  return {
    workbench,
    menuPath: resourceContextMenuPath(resource.type),
    context: { resource },
    onRequestParams: onRequestParams ?? (({ request }) => workbench.commandPalette.requestParams(request)),
    group: { id: `resource:${resource.extensionId ?? "pstdio"}:${resource.type}`, label: kind?.label ?? resource.type },
  } satisfies ResolveMenuEntriesInput & { group: { id: string; label: string } };
};

export const subscribeResourceKinds = (kinds: RegisteredResourceKind[], listener: () => void) => {
  const subscriptions = kinds.flatMap((kind) => (kind.subscribe ? [kind.subscribe(listener)] : []));
  return () => {
    for (const subscription of subscriptions) {
      if (typeof subscription === "function") subscription();
      else subscription.dispose();
    }
  };
};

// Fires when anything that decides a resource's actions changes: resource data,
// kinds, commands, context keys, or menu contributions.
export const subscribeResourceActionChanges = (workbench: WorkbenchCoreContributionContext, listener: () => void) => {
  let stopKinds = subscribeResourceKinds(workbench.resources.listKinds(), listener);
  const stops = [
    workbench.resources.preview.store.subscribeSelector((state) => state.changes, listener),
    workbench.resources.store.subscribeSelector(
      (state) => state.kinds,
      () => {
        stopKinds();
        stopKinds = subscribeResourceKinds(workbench.resources.listKinds(), listener);
        listener();
      },
    ),
    workbench.commands.store.subscribeSelector((state) => state.commands, listener),
    workbench.context.store.subscribeSelector((state) => state.values, listener),
    workbench.layout.menuStore.subscribeSelector((state) => state.itemsByPath, listener),
  ];
  return () => {
    stopKinds();
    for (const stop of stops) stop();
  };
};
