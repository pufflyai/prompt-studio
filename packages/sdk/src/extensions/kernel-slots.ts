import { eventRef } from "./refs";
import { defineSlot } from "./slots";
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
  sessionId: string | null;
  originalSessionId: string | null;
  worktreePath: string | null;
  workspace: JsonObject;
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
  started: eventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>("session.started"),
  completed: eventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>("session.completed"),
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
};

export const attemptStatusEvents = {
  changed: eventRef<AttemptStatusChangePayload>("attemptStatus.changed"),
};
