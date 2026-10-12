import type { PageRef, ResourceContext, ResourceRef } from "@pstdio/sdk/extensions";

export const windowingExtensionId = "storybook.windowing";
export const windowingPages = {
  workspaces: { kind: "page", extensionId: windowingExtensionId, id: "workspaces" },
  notesCollection: { kind: "page", extensionId: windowingExtensionId, id: "notes-collection" },
  workspace: { kind: "page", extensionId: windowingExtensionId, id: "workspace" },
  notes: { kind: "page", extensionId: windowingExtensionId, id: "notes" },
  sessions: { kind: "page", extensionId: windowingExtensionId, id: "sessions" },
  webview: { kind: "page", extensionId: windowingExtensionId, id: "webview" },
} as const satisfies Record<string, PageRef>;

export const createWindowingResources = () => {
  const contextListeners = new Set<() => void>();
  const workspaces: ResourceRef[] = [1, 2].map((number) => ({
    type: "windowing.workspace",
    id: `workspace-${number}`,
    label: `Workspace ${number}`,
    extensionId: windowingExtensionId,
    context: { type: "workspace", id: `workspace-${number}`, label: `Workspace ${number}` },
  }));
  const sessions = workspaces.map((workspace, index) => ({
    type: "windowing.session",
    id: `session-${index + 1}`,
    label: `Session ${index + 1}`,
    extensionId: windowingExtensionId,
    metadata: { workspaceId: workspace.id },
    context: { type: "workspace", id: workspace.id, label: workspace.label } as ResourceContext,
  }));
  const terminals = workspaces.map((workspace, index) => ({
    type: "windowing.terminal",
    id: `terminal-${index + 1}`,
    label: `Terminal ${index + 1}`,
    extensionId: windowingExtensionId,
    metadata: { workspaceId: workspace.id },
    context: { type: "workspace" as const, id: workspace.id, label: workspace.label },
  }));
  const notes: ResourceRef[] = ["A", "B"].map((letter) => ({
    type: "windowing.note",
    id: `note-${letter.toLowerCase()}`,
    label: `Note ${letter}`,
    extensionId: windowingExtensionId,
  }));
  return {
    workspaces,
    sessions,
    terminals,
    notes,
    subscribeContext(listener: () => void) {
      contextListeners.add(listener);
      return () => {
        contextListeners.delete(listener);
      };
    },
    updateSessionContext(id: string, context: ResourceContext) {
      const session = sessions.find((session) => session.id === id);
      if (!session) throw new Error(`Unknown session: ${id}`);
      session.context = context;
      for (const listener of contextListeners) listener();
    },
  };
};

export type WindowingResources = ReturnType<typeof createWindowingResources>;
