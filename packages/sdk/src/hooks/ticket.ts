import type { BaseHookContext } from "./base";

/** @deprecated Legacy core ticket hook context. Ticket lifecycle is owned by the pstdio tickets extension. */
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

/** @deprecated Legacy core ticket hook context. Ticket lifecycle is owned by the pstdio tickets extension. */
export type TicketCreationContext = Omit<TicketContext, "id" | "shorthand"> & {
  id: null;
  shorthand: null;
  content: string | null;
};

/** @deprecated Legacy core ticket hook context. Ticket lifecycle is owned by the pstdio tickets extension. */
export type TicketStatusChangeContext = TicketContext & {
  fromStatus: string | null;
  toStatus: string | null;
};
