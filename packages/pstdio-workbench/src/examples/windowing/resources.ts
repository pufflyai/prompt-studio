import type { PageRef, ResourceContext, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../core";

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
  let sessions = workspaces.map((workspace, index) => ({
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
    get sessions() {
      return sessions;
    },
    terminals,
    notes,
    startSession(workspace: ResourceRef) {
      const session = {
        type: "windowing.session",
        id: `session-${sessions.length + 1}`,
        label: `Session ${sessions.length + 1}`,
        extensionId: windowingExtensionId,
        metadata: { workspaceId: workspace.id },
        context: { type: "workspace", id: workspace.id, label: workspace.label } as ResourceContext,
      };
      sessions = [...sessions, session];
      for (const listener of contextListeners) listener();
      return session;
    },
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

export const registerWindowingResourceProviders = (workbench: WorkbenchCore, resources: WindowingResources) => {
  for (const [label, read] of [
    ["Workspace", () => resources.workspaces],
    ["Note", () => resources.notes],
    ["Session", () => resources.sessions],
    ["Terminal", () => resources.terminals],
  ] as const) {
    const kind = read()[0]!.type;
    workbench.resources.registerKind({ kind, label });
    workbench.resources.registerProvider({
      id: kind,
      kind,
      list: (query) =>
        read()
          .filter((item) => item.label?.toLowerCase().includes(query.toLowerCase()))
          .map((resource) => ({ resource })),
    });
  }
};
