// Compose the plan commands; the browser view infers its client types from this record.

import { readActionsCommand, requestActionCommand, resolveActionCommand } from "./action-commands";
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
  "timeline.plan.read": readPlanCommand,
  "timeline.plan.move": moveTicketCommand,
  "timeline.track.create": createTrackCommand,
  "timeline.track.assign": assignTrackCommand,
  "timeline.track.rename": renameTrackCommand,
  "timeline.ticket.create": createTicketCommand,
  "timeline.gate.create": createGateCommand,
  "timeline.gate.launch": launchGateCommand,
  "timeline.action.launch": launchActionCommand,
  "timeline.action.cancel": cancelActionCommand,
  "timeline.write-claim.read": readClaimsCommand,
  "timeline.write-claim.release": releaseClaimCommand,
  "timeline.action.read": readActionsCommand,
  "timeline.action.request": requestActionCommand,
  "timeline.action.resolve": resolveActionCommand,
  "timeline.deadline.create": createDeadlineCommand,
  "timeline.deadline.update": updateDeadlineCommand,
  "timeline.deadline.delete": deleteDeadlineCommand,
  "timeline.display.read": readDisplayCommand,
  "timeline.display.save": saveDisplayCommand,
};
