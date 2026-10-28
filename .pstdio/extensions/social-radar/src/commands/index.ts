import { listAnalysis } from "./analysis";
import { getChannelState, setChannelPaused } from "./channel-state";
import { saveCurrentIdea, saveIdeaCommand, setIdeaStatus, updateIdeaCommand } from "./ideas";
import { addMedia } from "./media";
import { finishRunCommand, getContext, listAnswered, listDigest, runDaily, startResearch } from "./runs";
import {
  addChannel,
  getSettings,
  removeChannel,
  saveSettings,
  setAgent,
  updateChannel,
  updateSettings,
} from "./settings";
import { addThreadImage } from "./thread-images";
import {
  getThread,
  recordOutcome,
  saveThreadCommand,
  setCurrentThreadStatus,
  setThreadStatus,
  updateThreadCommand,
} from "./threads";

// Keys match command ids, so webviews can call them through the typed client.
export const commands = {
  "run-daily": runDaily,
  "start-research": startResearch,
  "get-channel-state": getChannelState,
  "set-channel-paused": setChannelPaused,
  "get-context": getContext,
  "save-thread": saveThreadCommand,
  "save-idea": saveIdeaCommand,
  "save-current-idea": saveCurrentIdea,
  "update-thread": updateThreadCommand,
  "update-idea": updateIdeaCommand,
  "set-thread-status": setThreadStatus,
  "set-current-thread-status": setCurrentThreadStatus,
  "set-idea-status": setIdeaStatus,
  "get-thread": getThread,
  "add-media": addMedia,
  "add-thread-image": addThreadImage,
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
