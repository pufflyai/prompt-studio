export const PLANNER_EXTENSION_ID = "pstdio.planner";
export const PLANNER_EXTENSION_PACKAGE_NAME = "@pstdio/pstdio-ext-planner";

export type TicketPullInput = {
  ticketId?: string;
  force?: boolean;
};

export type TicketPullResult = {
  pulledTicketShorthands: string[];
  downloadedFileCount: number;
  messages: string[];
};

export type TicketPushInput = {
  ticketId: string;
  status?: string;
  tags?: string[];
};

export type TicketPushResult = {
  ticketId: string;
  uploadedFileCount: number;
  messages: string[];
};

export type PlannerTicketRecord = {
  id: string;
  projectId: string;
  shorthand: string;
  createdAt: string;
  draft: boolean;
  fileId: string | null;
  parentId: string | null;
  userPrompt: string | null;
  dependsOn: string | null;
  parallelizable: string | null;
  blockedReason: string | null;
  tagNames: string[];
};

export type PlannerTicketFileRecord = {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string | null;
};

export type PlannerTicketUploadInput = {
  fileName: string;
  relativePath?: string;
  content: Buffer;
  mimeType?: string | null;
};

export type PlannerTicketCreateInput = {
  shorthand: string;
  content: string;
  title?: string;
  draft?: boolean;
  parentId?: string | null;
  userPrompt?: string | null;
  statusId?: string | null;
  tagIds?: string[];
};

export type PlannerTicketUpdateInput = {
  blockedReason?: string | null;
  content?: string;
  fileId?: string | null;
  displayTitle?: string | null;
  draft?: boolean;
  archived?: boolean;
  parentId?: string | null;
  userPrompt?: string | null;
  statusId?: string | null;
  tagIds?: string[];
};

export type PlannerTicketProviderApi = {
  get(ticketId: string): Promise<PlannerTicketRecord | null>;
  getByShorthand(shorthand: string): Promise<PlannerTicketRecord | null>;
  list(input: { archived?: boolean }): Promise<PlannerTicketRecord[]>;
  listFiles(ticketId: string): Promise<PlannerTicketFileRecord[]>;
  readFileContent(ticketId: string, fileId: string): Promise<Buffer>;
  uploadFile(ticketId: string, input: PlannerTicketUploadInput): Promise<PlannerTicketFileRecord>;
  update(ticketId: string, input: PlannerTicketUpdateInput): Promise<PlannerTicketRecord | null>;
  delete(ticketId: string): Promise<boolean>;
  resolveStatusId(statusName: string): Promise<string>;
  resolveTagIds(tagNames: string[]): Promise<string[]>;
};

export type PlannerTicketWorkflowContext = {
  projectId: string;
  projectRoot: string;
  tickets: PlannerTicketProviderApi;
};

export type PlannerTicketWorkflow = {
  pull(ctx: PlannerTicketWorkflowContext, input: TicketPullInput): Promise<TicketPullResult>;
  push(ctx: PlannerTicketWorkflowContext, input: TicketPushInput): Promise<TicketPushResult>;
};
