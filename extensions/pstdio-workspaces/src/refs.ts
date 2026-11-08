import type { CommandRef, PageRef } from "@pstdio/sdk/extensions";

const extensionId = "pstdio.pstdio-workspaces";
const page = (id: string): PageRef => ({ kind: "page", extensionId, id });
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
