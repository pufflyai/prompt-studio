import { workbenchResourceKinds } from "./builtin-refs";
import { eventRef } from "./refs";
import { defineSlot } from "./slots";
import type { Struct } from "./types/json";
import type { ResourceAnchor } from "./types/resources";
import type { ExtensionWorkspace } from "./types/workspaces";

const hostEventRef = <TPayload extends Struct>(id: string) => eventRef<TPayload>({ extensionId: "pstdio", id });

const resourceMenuSlotRef = (resourceKind: { id: string }, id: string) =>
  defineSlot<Struct, "menu">(`${resourceKind.id}.${id}`, { kind: "menu" });

/** How a workspace's working tree is backed. `root` = the repo checkout itself; `cloud` is reserved. */
export type WorkspaceType = "worktree" | "root" | "cloud";

export interface WorkspaceProvisionPayload {
  projectId: string;
  workspaceId: string;
  workspace: ExtensionWorkspace;
  /** Absolute working directory to materialize files into — a worktree path or the repo root. */
  workspaceDir: string;
  repoPath: string;
  branch?: string;
  type: WorkspaceType;
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
  sidenav: defineSlot<Struct, "panel">("project.sidenav", { kind: "panel" }),
  headerPrimary: resourceMenuSlotRef(workbenchResourceKinds.project, "headerPrimary"),
  headerOverflow: resourceMenuSlotRef(workbenchResourceKinds.project, "headerOverflow"),
  settingsPanels: defineSlot<Struct, "settings">("project.settingsPanels", { kind: "settings" }),
};

export const sessionSlots = {
  headerPrimary: resourceMenuSlotRef(workbenchResourceKinds.session, "headerPrimary"),
  headerOverflow: resourceMenuSlotRef(workbenchResourceKinds.session, "headerOverflow"),
};

export const workspaceSlots = {
  headerPrimary: resourceMenuSlotRef(workbenchResourceKinds.workspace, "headerPrimary"),
  headerOverflow: resourceMenuSlotRef(workbenchResourceKinds.workspace, "headerOverflow"),
  sidenav: defineSlot<Struct, "panel">("workspace.sidenav", { kind: "panel" }),
};

export const projectEvents = {
  opened: hostEventRef<{ projectId: string }>("project.opened"),
};

export const sessionEvents = {
  started: hostEventRef<SessionLifecyclePayload & { anchors?: ResourceAnchor[] }>("session.started"),
  resumed: hostEventRef<SessionLifecyclePayload>("session.resumed"),
  awaitingInput: hostEventRef<SessionLifecyclePayload>("session.awaitingInput"),
  succeeded: hostEventRef<SessionLifecyclePayload>("session.succeeded"),
  failed: hostEventRef<SessionLifecyclePayload>("session.failed"),
  completed: hostEventRef<SessionLifecyclePayload & { anchors?: ResourceAnchor[] }>("session.completed"),
};

export const workspaceEvents = {
  created: hostEventRef<{ workspace: ExtensionWorkspace }>("workspace.created"),
  /** Awaited: harness extensions sync their agent dir into the working tree. Gates workspace readiness. */
  provision: hostEventRef<WorkspaceProvisionPayload>("workspace.provision"),
  /** Fire-and-forget after the workspace is ready: background setup (deps install, builds). */
  ready: hostEventRef<WorkspaceProvisionPayload>("workspace.ready"),
  archived: hostEventRef<{ workspace: ExtensionWorkspace }>("workspace.archived"),
  deleted: hostEventRef<{ workspace: ExtensionWorkspace }>("workspace.deleted"),
};

export const worktreeEvents = {
  removed: hostEventRef<WorktreeRemovedPayload>("worktree.removed"),
};

export const gitEvents = {
  committed: hostEventRef<CommitPayload>("git.committed"),
  rebased: hostEventRef<RebasePayload>("git.rebased"),
  merged: hostEventRef<MergePayload>("git.merged"),
  conflicted: hostEventRef<ConflictPayload>("git.conflicted"),
};
