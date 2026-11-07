const page = (id: string) => ({ kind: "page" as const, extensionId: "pstdio.pstdio-workspaces", id });
export const workspacePages = {
  list: page("workspaces"),
  workspace: page("workspace"),
  files: page("files"),
  overview: page("overview"),
  history: page("history"),
};
