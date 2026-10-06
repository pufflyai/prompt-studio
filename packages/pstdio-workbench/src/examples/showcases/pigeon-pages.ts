import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import type { PigeonThread } from "./pigeon-data";

export const pigeonResourcePage: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "pigeon-resource" };
export const pigeonHomePage: PageRef = { ...pigeonResourcePage, id: "pigeon" };
export const pigeonThreadResource = (thread: PigeonThread): ResourceRef => ({
  type: "pigeon.thread",
  id: thread.id,
  label: thread.subject,
});
