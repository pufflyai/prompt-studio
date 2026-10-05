import { listAnalysis } from "./analysis";
import { saveIdeaCommand, setIdeaStatus, updateIdeaCommand } from "./ideas";
import { addMedia } from "./media";
import { finishRunCommand, getContext, listAnswered, listDigest, runDaily } from "./runs";
import {
  addChannel,
  getSettings,
  removeChannel,
  saveSettings,
  setAgent,
  updateChannel,
  updateSettings,
} from "./settings";
import { getThread, recordOutcome, saveThreadCommand, setThreadStatus, updateThreadCommand } from "./threads";

// Keys match command ids, so webviews can call them through the typed client.
export const commands = {
  "run-daily": runDaily,
  "get-context": getContext,
  "save-thread": saveThreadCommand,
  "save-idea": saveIdeaCommand,
  "update-thread": updateThreadCommand,
  "update-idea": updateIdeaCommand,
  "set-thread-status": setThreadStatus,
  "set-idea-status": setIdeaStatus,
  "get-thread": getThread,
  "add-media": addMedia,
  "record-outcome": recordOutcome,
  "finish-run": finishRunCommand,
  "list-analysis": listAnalysis,
  "list-digest": listDigest,
  "list-answered": listAnswered,
  "get-settings": getSettings,
  "save-settings": saveSettings,
  "update-channel": updateChannel,
  "add-channel": addChannel,
  "remove-channel": removeChannel,
  "set-agent": setAgent,
  "update-settings": updateSettings,
};
