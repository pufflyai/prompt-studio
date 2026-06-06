// Ticket data owned by the tickets extension. Persisted in extension storage
// collections (project-scoped), not the legacy api tickets feature.

export interface StoredTicketAttachment {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

// Editable text files attached to a ticket (in addition to the ticket body).
// Stored inline on the ticket so a single get-ticket call hydrates the whole
// editor; the board query never reads them.
export interface StoredTicketFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTicket {
  id: string;
  shorthand: string;
  title: string;
  content: string;
  statusId: string | null;
  // Optional so tickets created before these fields existed still read cleanly;
  // the data layer defaults them on read.
  tagIds?: string[];
  attachments?: StoredTicketAttachment[];
  files?: StoredTicketFile[];
  parentId?: string | null;
  dependsOn?: string | null;
  blockedReason?: string | null;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredStatus {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

export type TagSelectionType = "single_select" | "multi_select";

export interface StoredTagOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  icon: string | null;
  description: string | null;
}

export interface StoredTag {
  id: string;
  name: string;
  type: TagSelectionType;
  sortOrder: number;
  options: StoredTagOption[];
}
