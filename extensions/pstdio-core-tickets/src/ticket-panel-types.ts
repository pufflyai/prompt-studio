import type { TicketRecord, TicketStatusDefinition } from "./ticket-data";

export interface CommandResponse {
  outcome: {
    reason?: string;
    status: "success" | "rejected" | "error";
    value?: unknown;
  };
}

export interface TicketBoardReadModel {
  statuses: TicketStatusDefinition[];
  tickets: TicketRecord[];
}

export interface TicketDocumentFile {
  id: string;
  name: string;
  content: string;
  language?: string;
  mimeType?: string;
  editable?: boolean;
}

export interface TicketDocumentProperty {
  id: string;
  label: string;
  value?: string | number | boolean | null;
}

export interface TicketDocumentReadModel {
  title?: string;
  activeFileId?: string;
  properties?: TicketDocumentProperty[];
  files: TicketDocumentFile[];
}

export interface ExtensionViewProps {
  lastCommand?: { commandId?: string };
}
