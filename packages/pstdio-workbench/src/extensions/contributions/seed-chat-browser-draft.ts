import type { ChatDraft, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCoreContributionContext } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { chatBrowserDraftKey, chatDraftOwnerKey } from "./chat-browser-draft-key";
import { seedLocalChatDraft } from "./chat-local-drafts";

/** Seed a newly allocated native chat resource before opening its provider-owned view. */
export const seedChatBrowserDraft = (input: {
  workbench: WorkbenchCoreContributionContext;
  resource: ResourceRef;
  viewId: string;
  extensionId: string;
  storageScope: string;
  draft: ChatDraft;
}) => {
  const { resource, viewId, extensionId, storageScope, workbench, draft } = input;
  const projectId = workbench.pages.store.getState().projectId;
  if (!projectId || resource.projectId !== projectId) throw new Error("The draft belongs to another project.");
  const scope = { ...getWorkbenchQueries(workbench).getScope(), projectId, extensionId };
  const owner = chatDraftOwnerKey(projectId, viewId, resource, resource.id);
  return seedLocalChatDraft(chatBrowserDraftKey(storageScope, scope, owner), draft);
};
