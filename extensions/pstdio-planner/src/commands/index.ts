import { workspaceAutomationCommands } from "../workspace-automations";
import { archiveTicketColumnActionCommand, archiveTicketCommand } from "./archive-ticket";
import { attachTicketFileCommand, detachTicketFileCommand } from "./attach-ticket-file";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";
import { getTicketCommand } from "./get-ticket";
import { getTicketContentCommand } from "./get-ticket-content";
import { implementTicketCommand } from "./implement-ticket";
import { linkReviewCommand } from "./link-review";
import { listTicketFilesCommand } from "./list-ticket-files";
import { listTicketsCommand } from "./list-tickets";
import { pullTicketCommand } from "./pull-ticket";
import { queryTicketResourcesCommand } from "./query-ticket-resources";
import { queryTicketsCommand } from "./query-tickets";
import { readTicketAttachmentCommand } from "./read-ticket-attachment";
import { readTicketsCommand } from "./read-tickets";
import { reorderTicketCommand } from "./reorder-ticket";
import { saveTicketCommand } from "./save-ticket";
import { saveTicketContentCommand } from "./save-ticket-content";
import { selectTicketDocumentCommand } from "./select-ticket-document";
import { setTicketAttributeCommand } from "./set-ticket-attribute";
import {
  approveProposalCommand,
  breakIntoSubTicketsCommand,
  createWorkspaceCommand,
  proposalRefinedCommand,
  refineTicketCommand,
  runAttemptCommand,
} from "./ticket-actions";
import {
  createTicketFileCommand,
  deleteTicketFileCommand,
  listTicketFilesTreeCommand,
  renameTicketFileCommand,
  updateTicketFileCommand,
} from "./ticket-files";
import {
  createTicketStatusCommand,
  deleteTicketStatusCommand,
  readTicketStatusesCommand,
  reorderTicketStatusesCommand,
  setDefaultTicketStatusCommand,
  updateTicketStatusCommand,
} from "./ticket-statuses";
import {
  createTagOptionCommand,
  createTicketTagCommand,
  deleteTagOptionCommand,
  deleteTicketTagCommand,
  readTicketTagsCommand,
  setTicketTagsCommand,
  updateTagOptionCommand,
  updateTicketTagCommand,
} from "./ticket-tags";
import {
  ticketWorkspacesCommand,
  ticketWorktreesListCommand,
  ticketWorktreesRemoveAllCommand,
} from "./ticket-workspaces";
import { updateTicketCommand } from "./update-ticket";
import { updateWhenAttemptStatusCommand } from "./update-when-attempt-status";
import { writeTicketCommand } from "./write-ticket";

export const plannerCommands = {
  "run-attempt": runAttemptCommand,
  "create-workspace": createWorkspaceCommand,
  "refine-ticket": refineTicketCommand,
  "proposal-refined": proposalRefinedCommand,
  "approve-proposal": approveProposalCommand,
  "break-into-sub-tickets": breakIntoSubTicketsCommand,

  "query-tickets": queryTicketsCommand,
  "read-tickets": readTicketsCommand,
  "list-tickets": listTicketsCommand,
  "query-ticket-resources": queryTicketResourcesCommand,
  "create-ticket": createTicketCommand,
  "attach-file": attachTicketFileCommand,
  "detach-file": detachTicketFileCommand,
  "get-ticket": getTicketCommand,
  "update-ticket": updateTicketCommand,
  "link-review": linkReviewCommand,
  "get-ticket-content": getTicketContentCommand,
  "save-ticket-content": saveTicketContentCommand,
  "select-ticket-document": selectTicketDocumentCommand,
  "create-ticket-file": createTicketFileCommand,
  "update-ticket-file": updateTicketFileCommand,
  "rename-ticket-file": renameTicketFileCommand,
  "delete-ticket-file": deleteTicketFileCommand,
  "read-ticket-attachment": readTicketAttachmentCommand,
  "ticket-files.tree.body": listTicketFilesTreeCommand,
  "set-ticket-attribute": setTicketAttributeCommand,
  "reorder-ticket": reorderTicketCommand,
  "archive-ticket": archiveTicketCommand,
  "ticket-column-action": archiveTicketColumnActionCommand,
  "delete-ticket": deleteTicketCommand,

  "write-ticket": writeTicketCommand,
  "save-ticket": saveTicketCommand,
  "pull-ticket": pullTicketCommand,
  "list-ticket-files": listTicketFilesCommand,
  "implement-ticket": implementTicketCommand,
  "update-when-attempt-status": updateWhenAttemptStatusCommand,
  "ticket-workspaces": ticketWorkspacesCommand,
  "ticket-worktrees-list": ticketWorktreesListCommand,
  "ticket-worktrees-remove-all": ticketWorktreesRemoveAllCommand,

  "ticketStatus.read": readTicketStatusesCommand,
  "ticketStatus.create": createTicketStatusCommand,
  "ticketStatus.update": updateTicketStatusCommand,
  "ticketStatus.delete": deleteTicketStatusCommand,
  "ticketStatus.setDefault": setDefaultTicketStatusCommand,
  "ticketStatus.reorder": reorderTicketStatusesCommand,

  "set-ticket-tags": setTicketTagsCommand,
  "ticketTag.read": readTicketTagsCommand,
  "ticketTag.create": createTicketTagCommand,
  "ticketTag.update": updateTicketTagCommand,
  "ticketTag.delete": deleteTicketTagCommand,
  "ticketTag.createOption": createTagOptionCommand,
  "ticketTag.updateOption": updateTagOptionCommand,
  "ticketTag.deleteOption": deleteTagOptionCommand,

  ...workspaceAutomationCommands,
};
