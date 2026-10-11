// Compose the plan commands; the browser view infers its client types from this record.

import { readClaimsCommand, releaseClaimCommand } from "./claim-commands";
import { createTicketCommand } from "./create-ticket";
import { createDeadlineCommand, deleteDeadlineCommand, updateDeadlineCommand } from "./deadline-commands";
import { createGateCommand } from "./gate-commands";
import { launchGateCommand } from "./launch-gate";
import { moveTicketCommand } from "./move-ticket";
import { readPlanCommand } from "./read-plan";
import { assignTrackCommand, createTrackCommand, renameTrackCommand } from "./track-commands";
import {
  createViewCommand,
  defaultViewCommand,
  deleteViewCommand,
  readViewsCommand,
  updateViewCommand,
} from "./view-commands";

export const commands = {
  "timeline.views.read": readViewsCommand,
  "timeline.views.create": createViewCommand,
  "timeline.views.update": updateViewCommand,
  "timeline.views.delete": deleteViewCommand,
  "timeline.views.default": defaultViewCommand,
  "timeline.plan.read": readPlanCommand,
  "timeline.plan.move": moveTicketCommand,
  "timeline.track.create": createTrackCommand,
  "timeline.track.assign": assignTrackCommand,
  "timeline.track.rename": renameTrackCommand,
  "timeline.ticket.create": createTicketCommand,
  "timeline.gate.create": createGateCommand,
  "timeline.gate.launch": launchGateCommand,
  "timeline.write-claim.read": readClaimsCommand,
  "timeline.write-claim.release": releaseClaimCommand,
  "timeline.deadline.create": createDeadlineCommand,
  "timeline.deadline.update": updateDeadlineCommand,
  "timeline.deadline.delete": deleteDeadlineCommand,
};
