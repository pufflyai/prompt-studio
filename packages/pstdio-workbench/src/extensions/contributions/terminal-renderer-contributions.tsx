import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
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

const createOwner = (input: RegisterWorkbenchExtensionContributionsInput, view: TerminalRecord) => {
  const ownerId = crypto.randomUUID();
  let current = true;
  const watch = watchClosedTerminalPlacements(input.workbench, view.id, ownerId, input.projectId);
  const nativeView = { ownerId, projectId: input.projectId, viewId: view.id, isCurrent: () => current };
  return {
    register(next: RegisterWorkbenchExtensionContributionsInput, currentView: TerminalRecord) {
      return next.workbench.views.registerView(
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
    },
    dispose() {
      current = false;
      watch.dispose();
    },
  };
};

/** Contribution refresh detaches a renderer; only a removed/changed owner or host teardown ends its PTYs. */
export const createWorkbenchExtensionTerminalRendererOwners = () => {
  const owners = new Map<string, { declaration: string; owner: ReturnType<typeof createOwner> }>();
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
        entry = { declaration: description, owner: createOwner(input, view) };
        try {
          const registration = entry.owner.register(input, view);
          owners.set(key, entry);
          return registration;
        } catch (error) {
          entry.owner.dispose();
          throw error;
        }
      }
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
