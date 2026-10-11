import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";

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
  const workspaces: ResourceRef[] = [1, 2].map((number) => ({
    type: "windowing.workspace",
    id: `workspace-${number}`,
    label: `Workspace ${number}`,
    extensionId: windowingExtensionId,
  }));
  const sessions = workspaces.map((workspace, index) => ({
    type: "windowing.session",
    id: `session-${index + 1}`,
    label: `Session ${index + 1}`,
    extensionId: windowingExtensionId,
    metadata: { workspaceId: workspace.id },
  }));
  const terminals = workspaces.map((workspace, index) => ({
    type: "windowing.terminal",
    id: `terminal-${index + 1}`,
    label: `Terminal ${index + 1}`,
    extensionId: windowingExtensionId,
    metadata: { workspaceId: workspace.id },
  }));
  const notes: ResourceRef[] = ["A", "B"].map((letter) => ({
    type: "windowing.note",
    id: `note-${letter.toLowerCase()}`,
    label: `Note ${letter}`,
    extensionId: windowingExtensionId,
  }));
  return { workspaces, sessions, terminals, notes };
};

export type WindowingResources = ReturnType<typeof createWindowingResources>;
