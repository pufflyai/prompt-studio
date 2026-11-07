import type { CommandRef, PageRef, ViewRef } from "@pstdio/sdk/extensions";

const extensionId = "pstdio.pstdio-workspaces";
const page = (id: string): PageRef => ({ kind: "page", extensionId, id });
const view = (id: string): ViewRef => ({ kind: "view", extensionId, id });
const command = (id: string): CommandRef => ({ kind: "command", extensionId, id });
export const workspacePages = {
  create: page("create"),
  list: page("workspaces"),
  files: page("files"),
  workspace: page("workspace"),
  overview: page("overview"),
  history: page("history"),
  form: page("action"),
  device: page("device"),
};
export const workspaceViews = {
  list: view("workspaces"),
  file: view("file"),
  tree: view("file-tree"),
  changes: view("changes"),
  summary: view("summary"),
  history: view("history"),
};
export const workspaceCommands = {
  open: command("open"),
  openFiles: command("open-files"),
  create: command("show-create"),
  rename: command("show-rename"),
  delete: command("show-delete"),
  session: command("open-session"),
  device: command("device"),
  createFile: command("create-file"),
  createDirectory: command("create-directory"),
  renameEntry: command("rename-entry"),
  deleteEntry: command("show-delete-entry"),
};

export const workspaceFileDocument = { metadataKey: "workspaceFilePath" };
