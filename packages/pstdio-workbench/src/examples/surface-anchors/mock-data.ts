import type { ResourceRef } from "../../core";

// Two workspaces, each owning its own sessions and terminals. Switching the active
// workspace (the primary) is what drives every surface-model behaviour this example
// demonstrates: projections follow it, terminals re-scope to it, and a session opened
// in one workspace disconnects when the primary leaves its scope.

export interface SurfaceWorkspace {
  id: string;
  uri: string;
  label: string;
  sessions: ResourceRef[];
  terminals: ResourceRef[];
}

export const WORKSPACE_KIND = "surface.workspace";
export const SESSION_KIND = "surface.session";
export const TERMINAL_KIND = "surface.terminal";

const session = (id: string, label: string): ResourceRef => ({
  kind: SESSION_KIND,
  uri: `pstdio://surface/session/${id}`,
  label,
  icon: "MessageCircle",
});

const terminal = (id: string, label: string): ResourceRef => ({
  kind: TERMINAL_KIND,
  uri: `pstdio://surface/terminal/${id}`,
  label,
  icon: "SquareTerminal",
});

export const surfaceWorkspaces: SurfaceWorkspace[] = [
  {
    id: "ws-a",
    uri: "pstdio://surface/workspace/ws-a",
    label: "Workspace A",
    sessions: [session("a1", "Implement auth"), session("a2", "Review layout")],
    terminals: [terminal("a1", "dev server"), terminal("a2", "tests")],
  },
  {
    id: "ws-b",
    uri: "pstdio://surface/workspace/ws-b",
    label: "Workspace B",
    sessions: [session("b1", "Fix migration")],
    terminals: [terminal("b1", "build")],
  },
];

export const workspaceResource = (workspace: SurfaceWorkspace): ResourceRef => ({
  kind: WORKSPACE_KIND,
  uri: workspace.uri,
  label: workspace.label,
  icon: "GitBranch",
});

export const findWorkspaceByUri = (uri: string | undefined) =>
  surfaceWorkspaces.find((workspace) => workspace.uri === uri);
