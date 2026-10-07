// Compose the plan commands; the browser view infers its client types from this record.

import { readActionsCommand, requestActionCommand, resolveActionCommand } from "./action-commands";
import {
  attachArtifactCommand,
  createArtifactCommand,
  listArtifactsCommand,
  previewArtifactCommand,
} from "./artifact-commands";
import { cancelActionCommand } from "./cancel-action";
import { readClaimsCommand, releaseClaimCommand } from "./claim-commands";
import { createTicketCommand } from "./create-ticket";
import { createDeadlineCommand, deleteDeadlineCommand, updateDeadlineCommand } from "./deadline-commands";
import { readDisplayCommand, saveDisplayCommand } from "./display-commands";
import { createGateCommand } from "./gate-commands";
import { launchActionCommand } from "./launch-action";
import { launchGateCommand } from "./launch-gate";
import { moveTicketCommand } from "./move-ticket";
import { readPlanCommand } from "./read-plan";
import { assignTrackCommand, createTrackCommand, renameTrackCommand } from "./track-commands";

export const commands = {
  "plan.read": readPlanCommand,
  "plan.move": moveTicketCommand,
  "track.create": createTrackCommand,
  "track.assign": assignTrackCommand,
  "track.rename": renameTrackCommand,
  "ticket.create": createTicketCommand,
  "artifact.create": createArtifactCommand,
  "artifact.attach": attachArtifactCommand,
  "artifact.list": listArtifactsCommand,
  "artifact.preview": previewArtifactCommand,
  "gate.create": createGateCommand,
  "gate.launch": launchGateCommand,
  "action.launch": launchActionCommand,
  "action.cancel": cancelActionCommand,
  "write-claim.read": readClaimsCommand,
  "write-claim.release": releaseClaimCommand,
  "action.read": readActionsCommand,
  "action.request": requestActionCommand,
  "action.resolve": resolveActionCommand,
  "deadline.create": createDeadlineCommand,
  "deadline.update": updateDeadlineCommand,
  "deadline.delete": deleteDeadlineCommand,
  "display.read": readDisplayCommand,
  "display.save": saveDisplayCommand,
};
