import type { CommandRunContext, ExtensionStorageCollection } from "@pstdio/sdk/extensions";
import type {
  PlannerTicketFileRecord,
  PlannerTicketRecord,
  PlannerTicketUpdateInput,
  PlannerTicketUploadInput,
  PlannerTicketWorkflowContext,
} from "../contract";

type StoredTicketFile = {
  id: string;
  fileName: string;
  mimeType: string | null;
  contentBase64: string;
  relativePath?: string;
};

type StoredTicket = PlannerTicketRecord & {
  archived: boolean;
  content: string;
  displayTitle: string | null;
  statusId: string | null;
  updatedAt: string;
  files: StoredTicketFile[];
};

type StoredStatus = {
  id: string;
  name: string;
};

type StoredTagOption = {
  id: string;
  name: string;
};

const nowTimestamp = () => new Date().toISOString();

const asStoredTicket = (value: unknown) => value as StoredTicket;
const asStoredStatus = (value: unknown) => value as StoredStatus;
const asStoredTagOption = (value: unknown) => value as StoredTagOption;

const ticketFileId = (ticketId: string) => `${ticketId}:ticket`;

const toPlannerTicket = (ticket: StoredTicket): PlannerTicketRecord => ({
  id: ticket.id,
  projectId: ticket.projectId,
  shorthand: ticket.shorthand,
  createdAt: ticket.createdAt,
  draft: ticket.draft,
  fileId: ticket.fileId,
  parentId: ticket.parentId,
  userPrompt: ticket.userPrompt,
  dependsOn: ticket.dependsOn,
  parallelizable: ticket.parallelizable,
  blockedReason: ticket.blockedReason,
  tagNames: ticket.tagNames,
});

const toPlannerFile = (file: StoredTicketFile): PlannerTicketFileRecord => ({
  id: file.id,
  fileName: file.fileName,
  mimeType: file.mimeType,
});

const listValues = async <TValue>(collection: ExtensionStorageCollection, convert: (value: unknown) => TValue) =>
  (await collection.list()).map((item) => convert(item.value));

const getStoredTicket = async (tickets: ExtensionStorageCollection, ticketId: string) => {
  const value = await tickets.get(ticketId);
  return value ? asStoredTicket(value) : null;
};

export const createPlannerStorage = (ctx: CommandRunContext) => {
  const tickets = ctx.storage.collection("tickets");
  const statuses = ctx.storage.collection("statuses");
  const tagOptions = ctx.storage.collection("tag_options");

  const putTicket = async (ticket: StoredTicket) => {
    await tickets.put(ticket.id, ticket);
    return ticket;
  };

  const createTicket = async (input: { shorthand: string; content: string; title?: string }) => {
    const timestamp = nowTimestamp();
    const ticket: StoredTicket = {
      id: input.shorthand,
      projectId: ctx.projectId,
      shorthand: input.shorthand,
      createdAt: timestamp,
      updatedAt: timestamp,
      draft: false,
      archived: false,
      fileId: ticketFileId(input.shorthand),
      parentId: null,
      userPrompt: null,
      dependsOn: null,
      parallelizable: null,
      blockedReason: null,
      tagNames: [],
      content: input.content,
      displayTitle: input.title ?? null,
      statusId: null,
      files: [],
    };

    await putTicket(ticket);
    return ticket;
  };

  const getByShorthand = async (shorthand: string) => {
    const ticket = await getStoredTicket(tickets, shorthand);
    return ticket ? toPlannerTicket(ticket) : null;
  };

  const uploadFile = async (ticketId: string, input: PlannerTicketUploadInput) => {
    const ticket = await getStoredTicket(tickets, ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    const existing = ticket.files.find((file) =>
      input.relativePath ? file.relativePath === input.relativePath : file.fileName === input.fileName,
    );
    const nextFile: StoredTicketFile = {
      id: existing?.id ?? crypto.randomUUID(),
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      contentBase64: input.content.toString("base64"),
      relativePath: input.relativePath,
    };
    const files = existing
      ? ticket.files.map((file) => (file.id === existing.id ? nextFile : file))
      : [...ticket.files, nextFile];

    await putTicket({ ...ticket, files, updatedAt: nowTimestamp() });
    return toPlannerFile(nextFile);
  };

  const update = async (ticketId: string, input: PlannerTicketUpdateInput) => {
    const ticket = await getStoredTicket(tickets, ticketId);
    if (!ticket) return null;

    const updated = await putTicket({
      ...ticket,
      blockedReason: input.blockedReason === undefined ? ticket.blockedReason : input.blockedReason,
      content: input.content ?? ticket.content,
      displayTitle: input.displayTitle === undefined ? ticket.displayTitle : input.displayTitle,
      draft: input.draft ?? ticket.draft,
      fileId: input.fileId === undefined ? ticket.fileId : input.fileId,
      parentId: input.parentId === undefined ? ticket.parentId : input.parentId,
      statusId: input.statusId === undefined ? ticket.statusId : input.statusId,
      tagNames: input.tagIds ?? ticket.tagNames,
      updatedAt: nowTimestamp(),
    });

    return toPlannerTicket(updated);
  };

  const provider = {
    get: async (ticketId) => {
      const ticket = await getStoredTicket(tickets, ticketId);
      return ticket ? toPlannerTicket(ticket) : null;
    },
    getByShorthand,
    list: async (input) =>
      (await listValues(tickets, asStoredTicket))
        .filter((ticket) => ticket.archived === (input.archived ?? false))
        .map(toPlannerTicket),
    listFiles: async (ticketId) => {
      const ticket = await getStoredTicket(tickets, ticketId);
      return ticket?.files.map(toPlannerFile) ?? [];
    },
    readFileContent: async (ticketId, fileId) => {
      const ticket = await getStoredTicket(tickets, ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
      if (fileId === ticket.fileId) return Buffer.from(ticket.content, "utf8");

      const file = ticket.files.find((candidate) => candidate.id === fileId);
      if (!file) throw new Error(`Ticket file not found: ${fileId}`);
      return Buffer.from(file.contentBase64, "base64");
    },
    uploadFile,
    update,
    resolveStatusId: async (statusName) => {
      const status = (await listValues(statuses, asStoredStatus)).find((candidate) => candidate.name === statusName);
      if (!status) throw new Error(`Status not found: ${statusName}`);
      return status.id;
    },
    resolveTagIds: async (tagNames) => {
      const options = await listValues(tagOptions, asStoredTagOption);
      return tagNames.map((tagName) => {
        const option = options.find((candidate) => candidate.name === tagName);
        if (!option) throw new Error(`Tag option not found: ${tagName}`);
        return option.id;
      });
    },
  } satisfies PlannerTicketWorkflowContext["tickets"];

  return { createTicket, provider };
};

export const createPlannerWorkflowContext = (ctx: CommandRunContext, projectRoot: string) =>
  ({
    projectId: ctx.projectId,
    projectRoot,
    tickets: createPlannerStorage(ctx).provider,
  }) satisfies PlannerTicketWorkflowContext;
