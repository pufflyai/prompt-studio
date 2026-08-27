import { applyTicketTemplateCommand } from "./apply-ticket-template";
import { archiveTicketColumnActionCommand, archiveTicketCommand } from "./archive-ticket";
import { attachTicketFileCommand, detachTicketFileCommand } from "./attach-ticket-file";
import {
  addReviewCommentCommand,
  dismissReviewCommand,
  readAttemptHistoryCommand,
  readReviewThreadCommand,
  resolveReviewThreadCommand,
  selectAttemptCommand,
} from "./attempt-history";
import { attemptReadinessCommand } from "./attempt-readiness";
import { automationPolicyCommand } from "./automation-policy";
import { submitChangeRequestCommand } from "./change-requests";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";
import { getTicketCommand } from "./get-ticket";
import { getTicketContentCommand } from "./get-ticket-content";
import { requestHumanCommand, resolveHumanRequestCommand } from "./human-requests";
import { implementTicketCommand } from "./implement-ticket";
import { linkReviewCommand } from "./link-review";
import { listTicketFilesCommand } from "./list-ticket-files";
import { listTicketTemplatesCommand } from "./list-ticket-templates";
import { listTicketsCommand } from "./list-tickets";
import { pullTicketCommand } from "./pull-ticket";
import { queryTicketsCommand } from "./query-tickets";
import { readTicketAttachmentCommand } from "./read-ticket-attachment";
import { readTicketsCommand } from "./read-tickets";
import { listAttemptsCommand, reconcileAttemptCommand } from "./reconcile-attempt";
import { reorderTicketCommand } from "./reorder-ticket";
import { runAttemptCommand } from "./run-attempt";
import { runReviewCommand } from "./run-review";
import { saveTicketCommand } from "./save-ticket";
import { saveTicketContentCommand } from "./save-ticket-content";
import { setTicketAttributeCommand } from "./set-ticket-attribute";
import { submitReviewCommand } from "./submit-review";
import {
  deleteTemplateCommand,
  listTemplatesCommand,
  readTemplateCommand,
  saveTemplateCommand,
} from "./template-commands";
import {
  approveProposalCommand,
  breakIntoSubTicketsCommand,
  createWorkspaceCommand,
  proposalRefinedCommand,
  refineTicketCommand,
} from "./ticket-actions";
import {
  createTicketFileCommand,
  deleteTicketFileCommand,
  listTicketFilesTreeCommand,
  renameTicketFileCommand,
  updateTicketFileCommand,
} from "./ticket-files";
import { ticketPropertiesQueryCommand } from "./ticket-properties/query";
import { ticketPropertiesUpdateCommand } from "./ticket-properties/update";
import {
  createTicketStatusCommand,
  deleteTicketStatusCommand,
  readTicketStatusesCommand,
  reorderTicketStatusesCommand,
  setDefaultTicketStatusCommand,
  updateTicketStatusCommand,
} from "./ticket-statuses";
import {
  applyTicketTagDraftCommand,
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
import { workspaceActivityCommand } from "./workspace-activity";
import { writeTicketCommand } from "./write-ticket";

export const plannerCommands = [
  listTemplatesCommand,
  readTemplateCommand,
  saveTemplateCommand,
  deleteTemplateCommand,
  applyTicketTemplateCommand,
  automationPolicyCommand,
  attemptReadinessCommand,
  submitChangeRequestCommand,
  submitReviewCommand,
  addReviewCommentCommand,
  resolveReviewThreadCommand,
  dismissReviewCommand,
  readReviewThreadCommand,
  readAttemptHistoryCommand,
  selectAttemptCommand,
  requestHumanCommand,
  resolveHumanRequestCommand,
  listAttemptsCommand,
  reconcileAttemptCommand,
  runAttemptCommand,
  createWorkspaceCommand,
  refineTicketCommand,
  proposalRefinedCommand,
  approveProposalCommand,
  breakIntoSubTicketsCommand,
  queryTicketsCommand,
  readTicketsCommand,
  listTicketsCommand,
  createTicketCommand,
  attachTicketFileCommand,
  detachTicketFileCommand,
  getTicketCommand,
  updateTicketCommand,
  linkReviewCommand,
  getTicketContentCommand,
  saveTicketContentCommand,
  createTicketFileCommand,
  updateTicketFileCommand,
  renameTicketFileCommand,
  deleteTicketFileCommand,
  readTicketAttachmentCommand,
  listTicketFilesTreeCommand,
  setTicketAttributeCommand,
  ticketPropertiesQueryCommand,
  ticketPropertiesUpdateCommand,
  reorderTicketCommand,
  archiveTicketCommand,
  archiveTicketColumnActionCommand,
  deleteTicketCommand,
  writeTicketCommand,
  saveTicketCommand,
  pullTicketCommand,
  listTicketFilesCommand,
  listTicketTemplatesCommand,
  implementTicketCommand,
  ticketWorkspacesCommand,
  ticketWorktreesListCommand,
  ticketWorktreesRemoveAllCommand,
  workspaceActivityCommand,
  runReviewCommand,
  readTicketStatusesCommand,
  createTicketStatusCommand,
  updateTicketStatusCommand,
  deleteTicketStatusCommand,
  setDefaultTicketStatusCommand,
  reorderTicketStatusesCommand,
  setTicketTagsCommand,
  readTicketTagsCommand,
  createTicketTagCommand,
  updateTicketTagCommand,
  deleteTicketTagCommand,
  createTagOptionCommand,
  updateTagOptionCommand,
  deleteTagOptionCommand,
  applyTicketTagDraftCommand,
];
