import { commandRef, eventRef } from "./refs";
import { defineSlot } from "./slots";
import type { SetAttemptStatusInput, SetAttemptStatusResult } from "./types/context";
import type { JsonObject, Struct } from "./types/json";
import type { ResourceAnchor } from "./types/resources";

export interface TicketArchivedEventPayload {
  projectId: string;
  ticket: {
    id: string;
    shorthand: string;
    displayTitle: string | null;
    userPrompt: string | null;
    parentId: string | null;
    draft: boolean;
    archived: boolean;
    status: string | null;
    tagIds: string[];
    tagNames: string[];
    fileIds: string[];
  };
}

export interface WorktreeCreatedEventPayload {
  projectId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  ticket: string;
}

export interface TicketLifecyclePayload {
  projectId: string;
  ticket: JsonObject;
}

export interface TicketStatusChangePayload {
  projectId: string;
  ticket: JsonObject;
  fromStatus: string | null;
  toStatus: string;
}

export interface AttemptStatusChangePayload {
  projectId: string;
  workspaceId: string;
  ticket: JsonObject | null;
  fromStatus: string | null;
  toStatus: string;
  statusChangeId?: string;
  sessionId: string | null;
  originalSessionId: string | null;
  worktreePath: string | null;
  workspace: JsonObject;
}

export interface SessionLifecyclePayload {
  projectId: string;
  sessionId: string;
  sessionStatus?: string;
  originalSessionId?: string;
  workspace?: JsonObject;
  workspaceId?: string;
  worktreePath?: string;
  branch?: string;
  ticket?: JsonObject;
  attemptStatus?: string;
}

export interface WorktreeRemovedPayload {
  projectId: string;
  repoPath?: string;
  worktreePath: string;
  workspace?: JsonObject;
  workspaceId?: string;
  ticket?: JsonObject | string;
}

export interface CommitPayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  commitSha?: string;
  workspace?: JsonObject;
  ticket?: JsonObject | string;
}

export interface RebasePayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: JsonObject;
  ticket?: JsonObject | string;
}

export interface MergePayload extends CommitPayload {}

export interface ConflictPayload {
  projectId: string;
  operation: "rebase" | "merge";
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: JsonObject;
  ticket?: JsonObject | string;
}

export const projectSlots = {
  sidebarNav: defineSlot<Struct, "navigation">("project.sidebarNav", { kind: "navigation" }),
  sidebar: defineSlot<Struct, "view">("project.sidebar", { kind: "view" }),
  headerPrimary: defineSlot<Struct, "menu">("project.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("project.headerOverflow", { kind: "menu" }),
  commandPanel: defineSlot<Struct, "menu">("project.commandPanel", { kind: "menu" }),
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
  tabs: defineSlot<Struct, "navigation">("workspace.tabs", { kind: "navigation" }),
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

export const ticketEvents = {
  created: eventRef<TicketLifecyclePayload>("ticket.created"),
  statusChanged: eventRef<TicketStatusChangePayload>("ticket.statusChanged"),
  archived: eventRef<TicketArchivedEventPayload>("ticket.archived"),
  deleted: eventRef<TicketLifecyclePayload>("ticket.deleted"),
};

export const workspaceEvents = {
  created: eventRef<{ workspace: JsonObject }>("workspace.created"),
  archived: eventRef<{ workspace: JsonObject }>("workspace.archived"),
  deleted: eventRef<{ workspace: JsonObject }>("workspace.deleted"),
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

export const attemptStatusEvents = {
  changed: eventRef<AttemptStatusChangePayload>("attemptStatus.changed"),
};

export const workspaceCommands = {
  setAttemptStatus: commandRef<SetAttemptStatusInput, SetAttemptStatusResult>("kernel.workspace.setAttemptStatus"),
};
