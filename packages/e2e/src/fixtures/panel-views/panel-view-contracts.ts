import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
export const mailboxPage = { kind: "page", id: "mailbox" } as const satisfies PageRef;
export const letterPage = { kind: "page", id: "letter" } as const satisfies PageRef;
export const letterResource = (id: string, projectId?: string): ResourceRef => ({
  type: "letter",
  id,
  projectId,
  label: `Letter ${id}`,
});
