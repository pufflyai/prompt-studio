import {
  defineCommand,
  type ExtensionWorkspace,
  params,
  type RendererContext,
  type TreeAction,
  type TreeNode,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource } from "../data/document-selection";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "../data/file-operations";
import { createTicketParentLookup, TICKET_RESOURCE_ICON, ticketDisplayTitle } from "../data/mappers";
import {
  linkedResourceParentMetadata,
  type TicketResourceReference,
  ticketResourceReference,
} from "../data/ticket-resource-hierarchy";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { plannerTicketsChanged } from "../events";
import { isImageAttachment } from "../utils/is-image-attachment";
import { createWorkspaceCommand } from "./ticket-actions";
import { buildSessionsSection } from "./ticket-sessions-tree";
import { buildSubTicketsSection } from "./ticket-sub-tickets-tree";

const TICKET_BODY_ID = "__ticket__";

type TicketTreeResource = {
  type?: string;
  id?: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

const fileEnding = (name: string) => {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex) : "";
};

const removeFileEnding = (name: string) => {
  const ending = fileEnding(name);
  return ending ? name.slice(0, -ending.length) : name;
};

const renameWithCurrentFileEnding = (name: string, currentName: string) => {
  const nextName = removeFileEnding(name.trim());
  return `${nextName}${fileEnding(currentName)}`;
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
  label: "Files",
  collapsible: true,
  nodes: [emptyFilesNode()],
});

// Prefer the (renamable) workspace name so the sidenav reflects renames; the immutable
// shorthand is only a fallback. The tree re-runs on workspace collection changes, so the
// label updates as soon as a rename streams back.
const workspaceLabel = (workspace: ExtensionWorkspace) =>
  workspace.name ?? workspace.workspace_shorthand ?? workspace.id;

// Canonical edge from a linked workspace to the ticket resource that owns it.
type LinkedWorkspaceMetadata = {
  resourceParent: TicketResourceReference;
};

const workspaceNode = (workspace: ExtensionWorkspace, ticket: LinkedWorkspaceMetadata): TreeNode => {
  const label = workspaceLabel(workspace);
  const workspaceMetadata = {
    workspaceId: workspace.id,
    ...(workspace.workspace_shorthand ? { workspaceShorthand: workspace.workspace_shorthand } : {}),
    workspaceType: workspace.worktree_path ? "worktree" : "current_branch",
    ...ticket,
  };

  return {
    id: `workspace-${workspace.id}`,
    label,
    icon: "GitBranch",
    // Native resource target so the host opens a normal workspace tab instead of
    // running extension-owned navigation. Its canonical parent edge keeps the workspace
    // nested beneath the owning ticket in Nav Chrome.
    target: { kind: "resource", resource: { type: "workspace", id: workspace.id, label, metadata: workspaceMetadata } },
  };
};

const workspaceActivityAt = (workspace: ExtensionWorkspace) => workspace.updated_at ?? workspace.created_at ?? "";

const createWorkspaceTreeActionParams = {
  repo: createWorkspaceCommand.params!.repo,
  mode: createWorkspaceCommand.params!.mode,
};

const workspaceSectionActions = (ticketId: string): TreeAction[] => [
  {
    id: "create-workspace",
    label: "Create workspace",
    icon: "Plus",
    command: "pstdio-planner.create-workspace",
    params: { ticket: ticketId },
    input: createWorkspaceTreeActionParams,
  },
];

const workspaceNodes = (workspaces: ExtensionWorkspace[], ticket: LinkedWorkspaceMetadata) =>
  [...workspaces]
    .sort((a, b) => {
      const activityOrder = workspaceActivityAt(b).localeCompare(workspaceActivityAt(a));
      return activityOrder !== 0 ? activityOrder : workspaceLabel(a).localeCompare(workspaceLabel(b));
    })
    .map((workspace) => workspaceNode(workspace, ticket));

const emptyWorkspacesNode = (): TreeNode => ({
  id: "workspaces-empty",
  label: "No workspaces",
  icon: "GitBranch",
  disabled: true,
  rowVariant: "empty-state",
});

const workspacesSection = (
  workspaces: ExtensionWorkspace[],
  ticketId: string,
  ticket: LinkedWorkspaceMetadata,
): TreeViewSection => ({
  id: "workspaces",
  label: "Workspaces",
  collapsible: true,
  actions: workspaceSectionActions(ticketId),
  nodes: workspaceNodes(workspaces, ticket).concat(workspaces.length === 0 ? [emptyWorkspacesNode()] : []),
});

const selectedTicketId = (ctx: { params: { ticketId?: string }; resource?: { type?: string; id?: string } }) =>
  ctx.params.ticketId ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);

const fileContextMenuActions = (input: { ticketId: string; fileId: string; fileName: string }) => {
  const actions: TreeAction[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "Pencil",
      command: "pstdio-planner.rename-ticket-file",
      params: { ticketId: input.ticketId, fileId: input.fileId, name: input.fileName },
      submitLabel: "Save",
      input: {
        name: params.text({ label: "File name", required: true, defaultValue: input.fileName }),
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: "Trash",
      command: "pstdio-planner.delete-ticket-file",
      params: { ticketId: input.ticketId, fileId: input.fileId },
    },
  ];
  return actions;
};

export const createTicketFileCommand = defineCommand({
  title: "Create ticket file",
  palette: { group: "Tickets", when: { resourceType: ["ticket"] } },
  params: {
    ticketId: params.text(),
    name: params.text({ label: "File name" }),
  },
  async run(ctx) {
    const ticketId = selectedTicketId(ctx);
    if (!ticketId) throw new Error("Ticket resource is required.");
    const file = await createTicketFile({ storage: ctx.storage, ticketId, name: ctx.params.name });
    await ctx.events.emit(plannerTicketsChanged, { ticketId });
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ...file, ticketId };
  },
});

export const updateTicketFileCommand = defineCommand({
  title: "Update ticket file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
    content: params.longText(),
    name: params.text(),
  },
  async run(ctx) {
    const ticket = await updateTicketFile({
      storage: ctx.storage,
      ticketId: ctx.params.ticketId,
      fileId: ctx.params.fileId,
      content: ctx.params.content,
      name: ctx.params.name,
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: ctx.params.ticketId });
    return ticket;
  },
});

export const renameTicketFileCommand = defineCommand({
  title: "Rename ticket file",
  params: {
    name: params.text({ label: "File name", required: true }),
  },
  async run(ctx) {
    const input = ctx.params as typeof ctx.params & { ticketId: string; fileId: string };
    const ticket = await ticketsCollection(ctx.storage).get(input.ticketId);
    const file = ticket?.files?.find((entry) => entry.id === input.fileId);
    const updated = await updateTicketFile({
      storage: ctx.storage,
      ticketId: input.ticketId,
      fileId: input.fileId,
      name: renameWithCurrentFileEnding(input.name, file?.name ?? ""),
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: input.ticketId });
    return updated;
  },
});

export const deleteTicketFileCommand = defineCommand({
  title: "Delete ticket file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx) {
    await deleteTicketFile({ storage: ctx.storage, ticketId: ctx.params.ticketId, fileId: ctx.params.fileId });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: ctx.params.ticketId });
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ticketId: ctx.params.ticketId, fileId: ctx.params.fileId };
  },
});

export const listTicketFilesTreeCommand = defineCommand({
  title: "List ticket files tree",
  params: {
    renderer: params.json<RendererContext>(),
  },
  async run(ctx) {
    const renderer = ctx.params.renderer ?? { rendererId: "pstdio-planner.ticketFiles" };
    const resource = renderer.resource as TicketTreeResource | undefined;
    const ticketId = resource?.type === "ticket" ? resource.id : undefined;
    if (!ticketId) return [emptyFilesSection()];

    const ticket = await ticketsCollection(ctx.storage).get(ticketId);
    if (!ticket) return [emptyFilesSection()];

    const selectedDocument = selectedDocumentFromResource(resource);
    const tickets = await ticketsCollection(ctx.storage).list();

    const parentLookup = createTicketParentLookup(tickets);
    const ticketMeta = linkedResourceParentMetadata(ticket, parentLookup);

    // The selected document travels with the ticket resource. This keeps the UI state
    // in the workbench and lets every renderer callback receive the same selection.
    const ticketResource = ticketResourceReference(ticket, parentLookup);
    const selectTarget = (documentId: string) =>
      ({
        kind: "resource" as const,
        resource: {
          ...ticketResource,
          metadata: { ...ticketResource.metadata, documentId },
        },
        input: { strategy: "replace-active" as const },
      }) satisfies TreeNode["target"];

    const ticketSection: TreeViewSection = {
      id: "ticket",
      collapsible: false,
      nodes: [
        {
          id: TICKET_BODY_ID,
          label: ticketDisplayTitle(ticket),
          icon: TICKET_RESOURCE_ICON,
          target: selectTarget(TICKET_BODY_ID),
          selected: selectedDocument === TICKET_BODY_ID,
        },
      ],
    };

    const fileNodes: TreeNode[] = [
      ...(ticket.files ?? []).map((file) => ({
        id: file.id,
        label: file.name,
        icon: "FileText",
        target: selectTarget(file.id),
        selected: selectedDocument === file.id,
        contextMenuActions: fileContextMenuActions({ ticketId, fileId: file.id, fileName: file.name }),
      })),
      // Image attachments open read-only in the editor's image preview.
      ...(ticket.attachments ?? []).filter(isImageAttachment).map((attachment) => ({
        id: attachment.id,
        label: attachment.name,
        icon: "Image",
        target: selectTarget(attachment.id),
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
          command: "pstdio-planner.create-ticket-file",
          params: { ticketId },
        },
      ],
      nodes: fileNodes.length === 0 ? [emptyFilesNode()] : fileNodes,
    };

    // Linked workspaces open as native workspace tabs from the same sidenav.
    const linkedWorkspaces = (await ctx.workspaces.list()).filter((workspace) =>
      isWorkspaceLinkedToTicket(workspace, ticket.shorthand),
    );

    const statusesById = new Map((await statusesCollection(ctx.storage).list()).map((status) => [status.id, status]));
    const maybeSubTicketsSection = buildSubTicketsSection({
      tickets,
      parentTicketId: ticket.id,
      statusesById,
    });
    const linkedWorkspacesSection = workspacesSection(linkedWorkspaces, ticket.id, ticketMeta);

    // Refine / Break into sub-tickets sessions anchor themselves to the ticket; attempts belong
    // to its workspaces. The ticket shows the whole conversation history either way.
    const workspaceSessions = (
      await Promise.all(linkedWorkspaces.map((workspace) => ctx.sessions.listByWorkspace(workspace.id)))
    ).flat();
    const sessionsSection = buildSessionsSection({
      sessions: await ctx.sessions.list(),
      ticketId: ticket.id,
      workspaceSessions,
    });

    return [
      ticketSection,
      filesSection,
      ...(maybeSubTicketsSection ? [maybeSubTicketsSection] : []),
      linkedWorkspacesSection,
      sessionsSection,
    ];
  },
});
