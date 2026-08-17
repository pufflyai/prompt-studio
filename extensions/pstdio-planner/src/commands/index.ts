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
import { listTicketsCommand } from "./list-tickets";
import { pullTicketCommand } from "./pull-ticket";
import { queryTicketResourcesCommand } from "./query-ticket-resources";
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

export const plannerCommands = {
  "automation-policy": automationPolicyCommand,
  "attempt-readiness": attemptReadinessCommand,
  "submit-change-request": submitChangeRequestCommand,
  "submit-review": submitReviewCommand,
  "add-review-comment": addReviewCommentCommand,
  "resolve-review-thread": resolveReviewThreadCommand,
  "dismiss-review": dismissReviewCommand,
  "read-review-thread": readReviewThreadCommand,
  "read-attempt-history": readAttemptHistoryCommand,
  "select-attempt": selectAttemptCommand,
  "request-human": requestHumanCommand,
  "resolve-human-request": resolveHumanRequestCommand,
  "list-attempts": listAttemptsCommand,
  "reconcile-attempt": reconcileAttemptCommand,
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
  "create-ticket-file": createTicketFileCommand,
  "update-ticket-file": updateTicketFileCommand,
  "rename-ticket-file": renameTicketFileCommand,
  "delete-ticket-file": deleteTicketFileCommand,
  "read-ticket-attachment": readTicketAttachmentCommand,
  "ticket-files.tree.body": listTicketFilesTreeCommand,
  "set-ticket-attribute": setTicketAttributeCommand,
  "ticket-properties.query": ticketPropertiesQueryCommand,
  "ticket-properties.update": ticketPropertiesUpdateCommand,
  "reorder-ticket": reorderTicketCommand,
  "archive-ticket": archiveTicketCommand,
  "ticket-column-action": archiveTicketColumnActionCommand,
  "delete-ticket": deleteTicketCommand,

  "write-ticket": writeTicketCommand,
  "save-ticket": saveTicketCommand,
  "pull-ticket": pullTicketCommand,
  "list-ticket-files": listTicketFilesCommand,
  "implement-ticket": implementTicketCommand,
  "ticket-workspaces": ticketWorkspacesCommand,
  "ticket-worktrees-list": ticketWorktreesListCommand,
  "ticket-worktrees-remove-all": ticketWorktreesRemoveAllCommand,
  "workspace-activity": workspaceActivityCommand,
  runReview: runReviewCommand,

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
  "ticketTag.applyDraft": applyTicketTagDraftCommand,
};
