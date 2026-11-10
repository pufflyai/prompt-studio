import {
  create,
  readForm,
  remove,
  removeEntry,
  rename,
  showCreate,
  showDelete,
  showDeleteEntry,
  showRename,
} from "./actions";
import { readChanges, readDiff } from "./diffs";
import { createDirectory, createFile, renameEntry } from "./files";
import { device, open, openFiles, openHistory, openSession, openTerminal } from "./navigation";
import { sessionPresentation } from "./session-presentation";
import { setLimit } from "./settings";
export const commands = {
  "session-presentation": sessionPresentation,
  create: create,
  "read-form": readForm,
  delete: remove,
  "delete-entry": removeEntry,
  rename: rename,
  "show-create": showCreate,
  "show-delete": showDelete,
  "show-delete-entry": showDeleteEntry,
  "show-rename": showRename,
  "read-changes": readChanges,
  "read-diff": readDiff,
  "create-directory": createDirectory,
  "create-file": createFile,
  "rename-entry": renameEntry,
  device: device,
  open: open,
  "open-files": openFiles,
  "open-session": openSession,
  "open-history": openHistory,
  "open-terminal": openTerminal,
  "set-limit": setLimit,
};
