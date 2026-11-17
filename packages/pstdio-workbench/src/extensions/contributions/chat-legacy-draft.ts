import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { hydrateChatDraft } from "./chat-draft-recovery";

export interface LegacyChatDraftTransfer {
  draft: ChatDraft;
  acknowledge(): void;
}

/** Persist both unsent bodies before acknowledging the exact legacy source snapshot. */
export const transferLegacyChatDraft = async (
  load: () => Promise<unknown>,
  save: ((draft: ChatDraft) => Promise<unknown>) | undefined,
  legacy: LegacyChatDraftTransfer | undefined,
) => {
  const current = chatDraftSchema.parse(await load());
  if (!legacy || !save) return current;
  const incoming = chatDraftSchema.parse(legacy.draft);
  const merged =
    !current.text && !current.attachments.length
      ? { ...incoming, values: { ...incoming.values, ...current.values }, recovered: current.recovered }
      : hydrateChatDraft(current, incoming);
  await save(merged);
  legacy.acknowledge();
  return merged;
};
