import {
  defineCommand,
  type ExtensionContextBase,
  l10n,
  params,
  type RendererContext,
  type TreeNode,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { TICKET_RESOURCE_ICON, ticketDisplayTitle } from "../data/mappers";
import { REVIEW_REQUEST_ICON, reviewRequestSummary } from "../data/review-request-summary";
import {
  REVIEW_REQUESTS_DOCUMENT,
  ticketFileTarget,
  ticketPageTarget,
  ticketRequestsTarget,
} from "../data/ticket-page-target";
import {
  linkedResourceParentMetadata,
  plannerOwnerFor,
  ticketResourceReference,
} from "../data/ticket-resource-hierarchy";
import { isImageAttachment } from "../utils/is-image-attachment";
import { createTicketFileCommand, fileContextMenuActions } from "./ticket-files";
import { readTicketTreeData } from "./ticket-files-tree-data";
import { mergeTicketLinkSections, ticketRelationshipSections } from "./ticket-link-sections";
import { buildSessionsSection } from "./ticket-sessions-tree";
import { buildSubTicketsSection } from "./ticket-sub-tickets-tree";
import { buildWorkspacesSection } from "./ticket-workspaces-tree";

type TicketTreeResource = {
  type?: string;
  id?: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

const emptyFilesNode = (): TreeNode => ({
  id: "files-empty",
  label: "No files",
  icon: "FileText",
  disabled: true,
  rowVariant: "empty-state",
});

const emptyFilesSection = (): TreeViewSection => ({
  id: "files",
  label: l10n("navigation.files", "Files"),
  collapsible: true,
  nodes: [emptyFilesNode()],
});

export const listTicketFilesTree = async (
  ctx: Pick<ExtensionContextBase, "extensionId" | "projectId" | "sessions" | "storage" | "workspaces" | "resources">,
  input: { renderer?: RendererContext },
) => {
  const renderer = input.renderer ?? { rendererId: "pstdio.pstdio-planner.view.ticket-files" };
  const resource = renderer.resource as TicketTreeResource | undefined;
  const ticketId = resource?.type === "ticket" ? resource.id : undefined;
  if (!ticketId) return [emptyFilesSection()];

  const ticket = await ticketsCollection(ctx).get(ticketId);
  if (!ticket) return [emptyFilesSection()];

  const selectedDocument = selectedDocumentFromResource(resource);
  const {
    tickets,
    children,
    dependents,
    reviewRequests,
    workspaces,
    linkedWorkspaces,
    workspaceCursor,
    providers,
    statusesById,
    sessions,
    workspaceSessions,
    resourceLinks,
    resourceCursor,
    sessionCursor,
  } = await readTicketTreeData(ctx, ticket);

  const parentLookup = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const ticketMeta = linkedResourceParentMetadata(ticket, parentLookup, plannerOwnerFor(ctx));

  const ticketResource = ticketResourceReference(ticket, parentLookup, plannerOwnerFor(ctx));

  const summary = reviewRequestSummary(reviewRequests);
  const reviewRequestsNode: TreeNode = {
    id: REVIEW_REQUESTS_DOCUMENT,
    label: l10n("requests.navigation.label", "Needs attention"),
    icon: REVIEW_REQUEST_ICON,
    badge: summary ? { label: String(summary.count), color: summary.color } : undefined,
    tooltip: summary?.tooltip,
    target: ticketRequestsTarget(ticketResource),
    selected: selectedDocument === REVIEW_REQUESTS_DOCUMENT,
  };

  const ticketSection: TreeViewSection = {
    id: "ticket",
    collapsible: false,
    nodes: [
      {
        id: TICKET_BODY_DOCUMENT,
        label: ticketDisplayTitle(ticket),
        icon: TICKET_RESOURCE_ICON,
        resource: ticketResource,
        target: ticketPageTarget(ticketResource),
        selected: selectedDocument === TICKET_BODY_DOCUMENT,
      },
      ...(summary ? [reviewRequestsNode] : []),
    ],
  };

  const fileNodes: TreeNode[] = [
    ...(ticket.files ?? []).map((file) => ({
      id: file.id,
      label: file.name,
      icon: "FileText",
      target: ticketFileTarget(ticketResource, file),
      selected: selectedDocument === file.id,
      contextMenuActions: fileContextMenuActions({ ticketId, fileId: file.id, fileName: file.name }),
    })),
    // Image attachments open read-only in the editor's image preview.
    ...(ticket.attachments ?? []).filter(isImageAttachment).map((attachment) => ({
      id: attachment.id,
      label: attachment.name,
      icon: "Image",
      target: ticketFileTarget(ticketResource, attachment, "Image"),
      selected: selectedDocument === attachment.id,
    })),
  ];

  const filesSection: TreeViewSection = {
    ...emptyFilesSection(),
    actions: [
      {
        id: "create",
        label: "New file",
        icon: "Plus",
        command: createTicketFileCommand.ref,
        params: { ticketId },
      },
    ],
    nodes: fileNodes.length === 0 ? [emptyFilesNode()] : fileNodes,
  };

  // Linked workspaces open as native workspace tabs from the same sidenav.
  const visibleWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.is_default || workspace.isDefault || linkedWorkspaces.some(({ id }) => id === workspace.id),
  );

  const maybeSubTicketsSection = buildSubTicketsSection({
    tickets,
    parentTicketId: ticket.id,
    statusesById,
    children: children.tickets,
    nextCursor: children.nextCursor,
  });
  const linkedWorkspacesSection = buildWorkspacesSection(
    visibleWorkspaces,
    ticketMeta,
    providers.length > 0
      ? {
          shorthand_base: ticket.shorthand,
          anchors: [
            { ...ticketMeta.resourceParent, projectId: ctx.projectId, extensionId: ctx.extensionId, role: "primary" },
          ],
        }
      : undefined,
  );

  if (workspaceCursor) Object.assign(linkedWorkspacesSection, { nextCursor: workspaceCursor });

  // Refine / Break into sub-tickets sessions anchor themselves to the ticket; attempts belong
  // to its workspaces. The ticket shows the whole conversation history either way.
  const sessionsSection = buildSessionsSection({
    sessions,
    ticketId: ticket.id,
    workspaceSessions,
  });

  if (sessionCursor) Object.assign(sessionsSection, { nextCursor: sessionCursor });

  const sections = mergeTicketLinkSections(
    [
      ticketSection,
      ...ticketRelationshipSections(ticket, tickets, plannerOwnerFor(ctx), dependents.tickets, dependents.nextCursor),
      filesSection,
      ...(maybeSubTicketsSection ? [maybeSubTicketsSection] : []),
      linkedWorkspacesSection,
      sessionsSection,
      ...(resourceCursor
        ? [
            {
              id: "related",
              label: l10n("navigation.related", "Related resources"),
              collapsible: true,
              nodes: [],
              nextCursor: resourceCursor,
            },
          ]
        : []),
    ],
    resourceLinks,
    ctx.projectId,
    plannerOwnerFor(ctx),
  );
  return sections.map((section) => ({
    ...section,
    ...(section.id === "sub-tickets" && children.nextCursor ? { nextCursor: children.nextCursor } : {}),
    ...(section.id === "required-by" && dependents.nextCursor ? { nextCursor: dependents.nextCursor } : {}),
  }));
};

export const listTicketFilesTreeCommand = defineCommand({
  id: "ticket-files.tree.body",
  title: "List ticket files tree",
  params: {
    renderer: params.json<RendererContext>(),
  },
  run: listTicketFilesTree,
});
