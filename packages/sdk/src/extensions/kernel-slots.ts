import { eventRef } from "./refs";
import { defineSlot } from "./slots";
import type { JsonObject, Struct } from "./types/json";
import type { ResourceAnchor } from "./types/resources";

export const projectSlots = {
  sidebarNav: defineSlot<Struct, "navigation">("project.sidebarNav", { kind: "navigation" }),
  headerPrimary: defineSlot<Struct, "menu">("project.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("project.headerOverflow", { kind: "menu" }),
  settingsPanels: defineSlot<Struct, "settings">("project.settingsPanels", { kind: "settings" }),
};

export const sessionSlots = {
  headerPrimary: defineSlot<Struct, "menu">("session.headerPrimary", { kind: "menu" }),
  headerOverflow: defineSlot<Struct, "menu">("session.headerOverflow", { kind: "menu" }),
  transcriptActions: defineSlot<Struct, "menu">("session.transcriptActions", { kind: "menu" }),
};

export const projectEvents = {
  opened: eventRef<{ projectId: string }>("project.opened"),
};

export const sessionEvents = {
  started: eventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>("session.started"),
  completed: eventRef<{ sessionId: string; anchors?: ResourceAnchor[] }>("session.completed"),
};

export const workspaceEvents = {
  created: eventRef<{ workspace: JsonObject }>("workspace.created"),
  archived: eventRef<{ workspace: JsonObject }>("workspace.archived"),
  deleted: eventRef<{ workspace: JsonObject }>("workspace.deleted"),
};
