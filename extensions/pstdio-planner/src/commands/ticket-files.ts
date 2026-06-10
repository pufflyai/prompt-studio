import {
  defineCommand,
  type ExtensionWorkspace,
  params,
  type TreeAction,
  type TreeNode,
  type TreeViewSection,
} from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { getSelectedDocument } from "../data/document-selection";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "../data/file-operations";
import { ticketDisplayTitle } from "../data/mappers";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { isImageAttachment } from "../utils/is-image-attachment";

const TICKET_BODY_ID = "__ticket__";

type TicketTreeResource = {
  type?: string;
  id?: string;
  label?: string;
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

const emptyFilesSection = (): TreeViewSection => ({
  id: "files",
  label: "Files",
  collapsible: false,
  nodes: [],
});

// Prefer the (renamable) workspace name so the sidebar reflects renames; the immutable
// shorthand is only a fallback. The tree re-runs on workspace collection changes, so the
// label updates as soon as a rename streams back.
const workspaceLabel = (workspace: ExtensionWorkspace) =>
  workspace.name ?? workspace.workspace_shorthand ?? workspace.id;

// Identifies the ticket a sidebar workspace belongs to so the dashboard can nest
// its breadcrumb under the ticket instead of the standalone workspaces board.
type WorkspaceTicketMeta = {
  ticketId: string;
  ticketShorthand: string;
  ticketLabel: string;
};

const workspaceNode = (workspace: ExtensionWorkspace, ticket: WorkspaceTicketMeta): TreeNode => {
  const label = workspaceLabel(workspace);

  return {
    id: `workspace-${workspace.id}`,
    label,
    icon: "GitBranch",
    // Native resource target so the host opens a normal workspace tab instead of
    // running extension-owned navigation. The ticket metadata travels along so the
    // dashboard renders a Tickets / Ticket / Workspace breadcrumb.
    target: { kind: "resource", resource: { type: "workspace", id: workspace.id, label, metadata: ticket } },
  };
};

const workspaceActivityAt = (workspace: ExtensionWorkspace) => workspace.updated_at ?? workspace.created_at ?? "";

const workspaceSectionActions = (ticketId: string): TreeAction[] => [
  {
    id: "create-workspace",
    label: "Create workspace",
    icon: "Plus",
    commandId: "pstdio-planner.create-workspace",
    args: { ticket: ticketId },
  },
];

const emptyWorkspacesState = {
  title: "No workspaces",
  description: "Create a workspace to start implementation.",
  icon: "GitBranch",
};

const workspacesSection = (workspaces: ExtensionWorkspace[], ticket: WorkspaceTicketMeta): TreeViewSection => ({
  id: "workspaces",
  label: "Workspaces",
  collapsible: true,
  actions: workspaceSectionActions(ticket.ticketId),
  emptyState: workspaces.length === 0 ? emptyWorkspacesState : undefined,
  nodes: [...workspaces]
    .sort((a, b) => {
      const activityOrder = workspaceActivityAt(b).localeCompare(workspaceActivityAt(a));
      return activityOrder !== 0 ? activityOrder : workspaceLabel(a).localeCompare(workspaceLabel(b));
    })
    .map((workspace) => workspaceNode(workspace, ticket)),
});

const selectedTicketId = (ctx: { params: { ticketId?: string }; resource?: { type?: string; id?: string } }) =>
  ctx.params.ticketId ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);

const fileContextMenuActions = (input: { ticketId: string; fileId: string; fileName: string }) => {
  const actions: TreeAction[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "Pencil",
      commandId: "pstdio-planner.rename-ticket-file",
      args: { ticketId: input.ticketId, fileId: input.fileId, name: input.fileName },
      submitLabel: "Save",
      params: {
        name: params.text({ label: "File name", required: true, defaultValue: input.fileName }),
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: "Trash",
      commandId: "pstdio-planner.delete-ticket-file",
      args: { ticketId: input.ticketId, fileId: input.fileId },
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
    return updateTicketFile({
      storage: ctx.storage,
      ticketId: ctx.params.ticketId,
      fileId: ctx.params.fileId,
      content: ctx.params.content,
      name: ctx.params.name,
    });
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
    return updateTicketFile({
      storage: ctx.storage,
      ticketId: input.ticketId,
      fileId: input.fileId,
      name: renameWithCurrentFileEnding(input.name, file?.name ?? ""),
    });
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
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ticketId: ctx.params.ticketId, fileId: ctx.params.fileId };
  },
});

export const listTicketFilesTreeCommand = defineCommand({
  title: "List ticket files tree",
  params: {
    treeId: params.text(),
    resource: params.json<TicketTreeResource>(),
  },
  async run(ctx) {
    const ticketId = ctx.params.resource?.type === "ticket" ? ctx.params.resource.id : undefined;
    if (!ticketId) return [emptyFilesSection()];

    const ticket = await ticketsCollection(ctx.storage).get(ticketId);
    if (!ticket) return [emptyFilesSection()];

    const selectedDocument = getSelectedDocument(ticket.id);

    // Travels in each file/attachment resource so the dashboard nests the
    // breadcrumb under the owning ticket.
    const ticketMeta: WorkspaceTicketMeta = {
      ticketId: ticket.id,
      ticketShorthand: ticket.shorthand,
      ticketLabel: ticketDisplayTitle(ticket),
    };

    // The ticket body is its own header-less entry above Files; it is the default
    // document. Selecting a node runs select-ticket-document, which swaps the single
    // editor pane in place (the editor stays bound to the one ticket resource).
    const selectTarget = (documentId: string) =>
      ({
        kind: "command" as const,
        commandId: "pstdio-planner.select-ticket-document",
        args: { ticketId, documentId },
      }) satisfies TreeNode["target"];

    const ticketSection: TreeViewSection = {
      id: "ticket",
      collapsible: false,
      nodes: [
        {
          id: TICKET_BODY_ID,
          label: "Ticket",
          icon: "FileText",
          target: selectTarget(TICKET_BODY_ID),
          selected: selectedDocument === TICKET_BODY_ID,
        },
      ],
    };

    const filesSection: TreeViewSection = {
      ...emptyFilesSection(),
      actions: [
        {
          id: "create",
          label: "New file",
          icon: "Plus",
          commandId: "pstdio-planner.create-ticket-file",
          args: { ticketId },
        },
      ],
      nodes: [
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
      ],
    };

    // Linked workspaces open as native workspace tabs from the same sidebar.
    const linkedWorkspaces = (await ctx.workspaces.list()).filter((workspace) =>
      isWorkspaceLinkedToTicket(workspace, ticket.shorthand),
    );

    return [ticketSection, filesSection, workspacesSection(linkedWorkspaces, ticketMeta)];
  },
});
