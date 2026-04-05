import type { BaseHookContext } from "./base";

export type TicketContext = BaseHookContext & {
  id: string;
  shorthand: string;
  displayTitle: string | null;
  userPrompt: string | null;
  parentId: string | null;
  draft: boolean;
  archived: boolean;
  status: string | null;
  tagIds: string[];
  tagNames: string[];
  fileIds: string[];
};

export type TicketCreationContext = Omit<TicketContext, "id" | "shorthand"> & {
  id: null;
  shorthand: null;
  content: string | null;
};

export type TicketStatusChangeContext = TicketContext & {
  fromStatus: string | null;
  toStatus: string | null;
};
