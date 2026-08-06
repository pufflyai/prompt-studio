import type { WorkbenchLayout } from "@pstdio/workbench";
import { type WorkbenchStorageLike, workbenchStoragePersistenceKey } from "@pstdio/workbench/storage";
import {
  type ExtensionLayoutCompatibility,
  reconcileExtensionLayout,
  resetExtensionLayout,
} from "./extension-layout-reconciliation";

interface MutableLayoutPersistence {
  dispose?(): void;
  flush?(): void;
  getLayout(scope?: string): WorkbenchLayout | undefined;
  setWriteGuard(guard: {
    capture(scope: string | undefined): string | undefined;
    isCurrent(scope: string | undefined, writeFence: string | undefined): boolean;
  }): void;
  setLayout(layout: WorkbenchLayout, scope?: string): void;
  updateLayouts(
    update: (layout: WorkbenchLayout, scope: string | undefined) => WorkbenchLayout,
    matchesScope?: (scope: string | undefined) => boolean,
  ): { scopes: string[]; updated: number };
}

const readCompatibility = (storage: WorkbenchStorageLike, key: string) => {
  const raw = storage.getItem(key);
  if (!raw) return undefined;
  try {
    const compatibility = JSON.parse(raw) as ExtensionLayoutCompatibility;
    return typeof compatibility.revision === "string" && Array.isArray(compatibility.panels)
      ? compatibility
      : undefined;
  } catch {
    return undefined;
  }
};

const projectIdFromScope = (scope: string | undefined) => scope?.match(/^project\/([^/]+)\//)?.[1];

const writeFenceRevision = (
  compatibility: ExtensionLayoutCompatibility,
  resets: Array<{ extensionId: string; modeId?: string; revision: string }>,
) =>
  JSON.stringify({
    compatibility: compatibility.revision,
    resets: [...resets].sort((left, right) =>
      `${left.extensionId}\0${left.modeId ?? ""}`.localeCompare(`${right.extensionId}\0${right.modeId ?? ""}`),
    ),
  });

export const createExtensionLayoutPersistence = (input: {
  layoutPersistence: MutableLayoutPersistence;
  namespace: string;
  storage: WorkbenchStorageLike;
}) => {
  const observedWriteFences = new Map<string, string>();
  const currentCompatibility = new Map<string, ExtensionLayoutCompatibility>();
  input.layoutPersistence.setWriteGuard({
    capture: (scope) => {
      const projectId = projectIdFromScope(scope);
      return projectId ? observedWriteFences.get(projectId) : undefined;
    },
    isCurrent: (scope, writeFence) => {
      const projectId = projectIdFromScope(scope);
      if (!projectId || !writeFence) return true;
      const key = workbenchStoragePersistenceKey(input.namespace, "layout-write-fence", projectId);
      return input.storage.getItem(key) === writeFence;
    },
  });

  const reconcileCurrentLayout = (layout: WorkbenchLayout, scope: string | undefined) => {
    const projectId = projectIdFromScope(scope);
    const current = projectId ? currentCompatibility.get(projectId) : undefined;
    return current ? reconcileExtensionLayout({ current, layout }) : layout;
  };

  const layoutPersistence = {
    getLayout: (scope?: string) => {
      const layout = input.layoutPersistence.getLayout(scope);
      if (!layout) return undefined;
      const reconciled = reconcileCurrentLayout(layout, scope);
      if (JSON.stringify(reconciled) !== JSON.stringify(layout)) input.layoutPersistence.setLayout(reconciled, scope);
      return reconciled;
    },
    setLayout: (layout: WorkbenchLayout, scope?: string) =>
      input.layoutPersistence.setLayout(reconcileCurrentLayout(layout, scope), scope),
    flush: input.layoutPersistence.flush,
    dispose: input.layoutPersistence.dispose,
  };

  return {
    layoutPersistence,
    reconcile(projectId: string, current: ExtensionLayoutCompatibility) {
      currentCompatibility.set(projectId, current);
      const key = workbenchStoragePersistenceKey(input.namespace, "layout-compatibility", projectId);
      const previous = readCompatibility(input.storage, key);
      if (previous?.revision === current.revision) return { previous, scopes: [], updated: 0 };

      const result = input.layoutPersistence.updateLayouts(
        (layout) => reconcileExtensionLayout({ current, layout, previous }),
        (scope) => scope?.startsWith(`project/${projectId}/`) === true,
      );
      input.storage.setItem(key, JSON.stringify(current));
      return { previous, ...result };
    },
    applyResets(
      projectId: string,
      current: ExtensionLayoutCompatibility,
      resets: Array<{
        extensionId: string;
        modeId?: string;
        revision: string;
      }>,
    ) {
      const applied: Array<{ extensionId: string; modeId?: string; scopes: string[] }> = [];
      for (const reset of resets) {
        const key = workbenchStoragePersistenceKey(
          input.namespace,
          "layout-reset",
          `${projectId}/${reset.extensionId}`,
        );
        if (input.storage.getItem(key) === reset.revision) continue;
        const result = input.layoutPersistence.updateLayouts(
          (layout) => resetExtensionLayout(layout, current, reset.extensionId),
          (scope) => {
            if (!scope?.startsWith(`project/${projectId}/`)) return false;
            return reset.modeId ? scope.startsWith(`project/${projectId}/mode/${reset.modeId}/`) : true;
          },
        );
        input.storage.setItem(key, reset.revision);
        applied.push({ extensionId: reset.extensionId, modeId: reset.modeId, scopes: result.scopes });
      }
      const writeFence = writeFenceRevision(current, resets);
      observedWriteFences.set(projectId, writeFence);
      input.storage.setItem(
        workbenchStoragePersistenceKey(input.namespace, "layout-write-fence", projectId),
        writeFence,
      );
      return applied;
    },
  };
};
