import { eventRef } from "./refs";
import { defineSlot } from "./slots";
import type { ExtensionWorkspace } from "./types/context";
import type { Struct } from "./types/json";
import type { ResourceAnchor } from "./types/resources";

export interface WorktreeCreatedEventPayload {
  projectId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  anchors?: ResourceAnchor[];
}

export interface SessionLifecyclePayload {
  projectId: string;
  sessionId: string;
  sessionStatus?: string;
  originalSessionId?: string;
  workspace?: ExtensionWorkspace;
  workspaceId?: string;
  worktreePath?: string;
  branch?: string;
  anchors?: ResourceAnchor[];
}

export interface WorktreeRemovedPayload {
  projectId: string;
  repoPath?: string;
  worktreePath: string;
  workspace?: ExtensionWorkspace;
  workspaceId?: string;
  anchors?: ResourceAnchor[];
}

export interface CommitPayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  commitSha?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}

export interface RebasePayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}

export interface MergePayload extends CommitPayload {}

export interface ConflictPayload {
  projectId: string;
  operation: "rebase" | "merge";
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  anchors?: ResourceAnchor[];
}

export const projectSlots = {
  sidebar: defineSlot<Struct, "view">("project.sidebar", { kind: "view" }),
  headerPrimary: defineSlot<Struct, "menu">("project.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("project.headerOverflow", { kind: "menu" }),
  settingsPanels: defineSlot<Struct, "settings">("project.settingsPanels", { kind: "settings" }),
};

export const sessionSlots = {
  headerPrimary: defineSlot<Struct, "menu">("session.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("session.headerOverflow", { kind: "menu" }),
  transcriptActions: defineSlot<Struct, "menu">("session.transcriptActions", { kind: "menu" }),
};

export const workspaceSlots = {
  headerPrimary: defineSlot<Struct, "menu">("workspace.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("workspace.headerOverflow", { kind: "menu" }),
  sidebar: defineSlot<Struct, "view">("workspace.sidebar", { kind: "view" }),
};

export const projectEvents = {
  opened: eventRef<{ projectId: string }>("project.opened"),
};

export const sessionEvents = {
  started: eventRef<SessionLifecyclePayload & { anchors?: ResourceAnchor[] }>("session.started"),
  resumed: eventRef<SessionLifecyclePayload>("session.resumed"),
  awaitingInput: eventRef<SessionLifecyclePayload>("session.awaitingInput"),
  succeeded: eventRef<SessionLifecyclePayload>("session.succeeded"),
  failed: eventRef<SessionLifecyclePayload>("session.failed"),
  completed: eventRef<SessionLifecyclePayload & { anchors?: ResourceAnchor[] }>("session.completed"),
};

export const workspaceEvents = {
  created: eventRef<{ workspace: ExtensionWorkspace }>("workspace.created"),
  archived: eventRef<{ workspace: ExtensionWorkspace }>("workspace.archived"),
  deleted: eventRef<{ workspace: ExtensionWorkspace }>("workspace.deleted"),
};

export const worktreeEvents = {
  created: eventRef<WorktreeCreatedEventPayload>("worktree.created"),
  removed: eventRef<WorktreeRemovedPayload>("worktree.removed"),
};

export const gitEvents = {
  committed: eventRef<CommitPayload>("git.committed"),
  rebased: eventRef<RebasePayload>("git.rebased"),
  merged: eventRef<MergePayload>("git.merged"),
  conflicted: eventRef<ConflictPayload>("git.conflicted"),
};
