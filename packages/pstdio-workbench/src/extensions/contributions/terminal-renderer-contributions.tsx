import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import { runUserAction } from "../../core/shared/run-user-action";
import { watchClosedTerminalPlacements } from "../../react/terminal/watch-terminal-placements";
import { WorkbenchTerminalPanel } from "../../react/terminal/workbench-terminal-panel";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";

type TerminalRecord = WorkbenchExtensionMetadata["views"][number];
const keyFor = (projectId: string, viewId: string) => JSON.stringify([projectId, viewId]);
const declaration = (metadata: WorkbenchExtensionMetadata, view: TerminalRecord) => {
  const owner = metadata.extensions.find((extension) => extension.id === view.extensionId);
  return JSON.stringify([
    view.extensionId,
    owner?.extensionInstanceId,
    owner?.installedExtensionId,
    owner?.sourcePath,
    view.body,
  ]);
};

const createOwner = (
  input: RegisterWorkbenchExtensionContributionsInput,
  view: TerminalRecord,
  onInactive: () => void,
) => {
  const ownerId = crypto.randomUUID();
  let current = true;
  let registrations = 0;
  let watch: ReturnType<typeof watchClosedTerminalPlacements> | undefined;
  let stopOwnership: (() => void) | undefined;
  const hasSessions = () => input.workbench.terminal.hasOwner(ownerId);
  const detachWatch = () => {
    if (registrations || hasSessions()) return;
    watch?.dispose();
    watch = undefined;
    stopOwnership?.();
    stopOwnership = undefined;
    onInactive();
  };
  const observe = () => {
    stopOwnership ??= input.workbench.terminal.onDidChangeOwnership(detachWatch);
    watch ??= watchClosedTerminalPlacements(input.workbench, view.id, ownerId, input.projectId, (instanceId) => {
      void runUserAction(input.workbench, "Close terminal", () =>
        input.workbench.terminal.killBinding(instanceId, ownerId),
      ).finally(detachWatch);
    });
  };
  const nativeView = { ownerId, projectId: input.projectId, viewId: view.id, isCurrent: () => current };
  return {
    active: () => registrations > 0 || hasSessions(),
    register(next: RegisterWorkbenchExtensionContributionsInput, currentView: TerminalRecord) {
      const registration = next.workbench.views.registerView(
        {
          id: view.id,
          title: text(currentView.title, view.id),
          icon: currentView.icon,
          body: {
            kind: "terminal",
            render: (render) =>
              current ? (
                <WorkbenchTerminalPanel
                  key={ownerId}
                  placement={render.instance}
                  workbench={render.workbench}
                  nativeView={nativeView}
                />
              ) : null,
          },
        },
        { ownerId: view.extensionId, source: "extension" },
      );
      registrations++;
      observe();
      let released = false;
      return {
        dispose() {
          if (released) return;
          released = true;
          registrations--;
          try {
            registration.dispose();
          } finally {
            detachWatch();
          }
        },
      };
    },
    dispose() {
      if (!current) return;
      current = false;
      stopOwnership?.();
      stopOwnership = undefined;
      watch?.dispose();
      watch = undefined;
      void runUserAction(input.workbench, "Close terminal", () => input.workbench.terminal.killOwner(ownerId));
    },
  };
};

/** Contribution refresh detaches a renderer; only a removed/changed owner or host teardown ends its PTYs. */
export const createWorkbenchExtensionTerminalRendererOwners = () => {
  const owners = new Map<string, { declaration: string; owner: ReturnType<typeof createOwner> }>();
  const trim = () => {
    const inactive = [...owners].filter(([, entry]) => !entry.owner.active());
    for (const [key, entry] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      owners.delete(key);
      entry.owner.dispose();
    }
  };
  return {
    checkpoint() {
      const previous = new Map(owners);
      return {
        rollback() {
          for (const [key, entry] of owners) {
            if (previous.get(key) !== entry) entry.owner.dispose();
          }
          owners.clear();
          for (const [key, entry] of previous) owners.set(key, entry);
        },
        commit() {
          for (const [key, entry] of previous) {
            if (owners.get(key) !== entry) entry.owner.dispose();
          }
          trim();
        },
      };
    },
    reconcile(projectId: string, metadata: WorkbenchExtensionMetadata) {
      const next = new Map(
        metadata.views.flatMap((view) =>
          view.body.kind === "terminal" ? [[keyFor(projectId, view.id), declaration(metadata, view)]] : [],
        ),
      );
      for (const [key, entry] of owners) {
        if (JSON.parse(key)[0] !== projectId) continue;
        if (next.get(key) === entry.declaration) continue;
        entry.owner.dispose();
        owners.delete(key);
      }
    },
    register(input: RegisterWorkbenchExtensionContributionsInput, view: TerminalRecord) {
      const key = keyFor(input.projectId, view.id);
      const description = declaration(input.metadata, view);
      let entry = owners.get(key);
      if (entry?.declaration !== description) {
        entry = { declaration: description, owner: createOwner(input, view, trim) };
        try {
          const registration = entry.owner.register(input, view);
          owners.delete(key);
          owners.set(key, entry);
          return registration;
        } catch (error) {
          entry.owner.dispose();
          throw error;
        }
      }
      owners.delete(key);
      owners.set(key, entry);
      return entry.owner.register(input, view);
    },
    dispose() {
      for (const entry of owners.values()) entry.owner.dispose();
      owners.clear();
    },
  };
};
export type TerminalRendererOwners = ReturnType<typeof createWorkbenchExtensionTerminalRendererOwners>;

export const registerWorkbenchExtensionTerminalRenderers = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const local = input.terminalRendererOwners ? undefined : createWorkbenchExtensionTerminalRendererOwners();
  const owners = input.terminalRendererOwners ?? local!;
  const transaction = owners.checkpoint();
  const registrations: Array<{ dispose(): void }> = [];
  const dispose = () => {
    for (const registration of registrations.reverse()) registration.dispose();
    local?.dispose();
  };
  try {
    for (const view of input.metadata.views) {
      if (view.body.kind === "terminal") registrations.push(owners.register(input, view));
    }
    return { dispose, ...transaction };
  } catch (error) {
    dispose();
    transaction.rollback();
    throw error;
  }
};
