import { commandRef, eventRef } from "./refs";
import { defineSlot } from "./slots";
import type {
  ExtensionTicket,
  ExtensionWorkspace,
  SetAttemptStatusInput,
  SetAttemptStatusResult,
} from "./types/context";
import type { Struct } from "./types/json";
import type { ResourceAnchor } from "./types/resources";

/** @deprecated Legacy core ticket event payload. Ticket events are owned by the pstdio tickets extension. */
export interface TicketArchivedEventPayload {
  projectId: string;
  ticket: ExtensionTicket;
}

export interface WorktreeCreatedEventPayload {
  projectId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  /** @deprecated Legacy ticket worktree linkage. Ticket worktree setup is owned by the pstdio tickets extension. */
  ticket: string;
}

/** @deprecated Legacy core ticket event payload. Ticket events are owned by the pstdio tickets extension. */
export interface TicketLifecyclePayload {
  projectId: string;
  ticket: ExtensionTicket;
}

/** @deprecated Legacy core ticket event payload. Ticket events are owned by the pstdio tickets extension. */
export interface TicketStatusChangePayload {
  projectId: string;
  ticket: ExtensionTicket;
  fromStatus: string | null;
  toStatus: string | null;
}

export interface AttemptStatusChangePayload {
  projectId: string;
  workspaceId: string;
  /** @deprecated Legacy ticket attempt linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket: ExtensionTicket | null;
  fromStatus: string | null;
  toStatus: string;
  statusChangeId?: string;
  sessionId: string | null;
  originalSessionId: string | null;
  worktreePath: string | null;
  workspace: ExtensionWorkspace;
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
  /** @deprecated Legacy ticket session linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket?: ExtensionTicket;
  attemptStatus?: string;
}

export interface WorktreeRemovedPayload {
  projectId: string;
  repoPath?: string;
  worktreePath: string;
  workspace?: ExtensionWorkspace;
  workspaceId?: string;
  /** @deprecated Legacy ticket worktree linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket?: ExtensionTicket | string;
}

export interface CommitPayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  commitSha?: string;
  workspace?: ExtensionWorkspace;
  /** @deprecated Legacy ticket git linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket?: ExtensionTicket | string;
}

export interface RebasePayload {
  projectId: string;
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  ticket?: ExtensionTicket | string;
}

export interface MergePayload extends CommitPayload {}

export interface ConflictPayload {
  projectId: string;
  operation: "rebase" | "merge";
  repoPath?: string;
  worktreePath?: string;
  branch?: string;
  workspace?: ExtensionWorkspace;
  /** @deprecated Legacy ticket git linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket?: ExtensionTicket | string;
}

export const projectSlots = {
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

/** @deprecated Legacy core ticket slots. Ticket UI contributions are owned by the pstdio tickets extension. */
export const ticketSlots = {
  headerPrimary: defineSlot<Struct, "menu">("ticket.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("ticket.headerOverflow", { kind: "menu" }),
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

/** @deprecated Legacy core ticket events. Ticket events are owned by the pstdio tickets extension. */
export const ticketEvents = {
  created: eventRef<TicketLifecyclePayload>("ticket.created"),
  statusChanged: eventRef<TicketStatusChangePayload>("ticket.statusChanged"),
  archived: eventRef<TicketArchivedEventPayload>("ticket.archived"),
  deleted: eventRef<TicketLifecyclePayload>("ticket.deleted"),
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

/** @deprecated Legacy ticket attempt status events. Workspace status automation is extension-owned. */
export const attemptStatusEvents = {
  changed: eventRef<AttemptStatusChangePayload>("attemptStatus.changed"),
};

export const workspaceCommands = {
  setAttemptStatus: commandRef<SetAttemptStatusInput, SetAttemptStatusResult>("kernel.workspace.setAttemptStatus"),
};
