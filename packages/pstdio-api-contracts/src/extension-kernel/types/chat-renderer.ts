import type {
  ChatDraft,
  ChatLinkCandidate,
  ChatLinkPresentation,
  ChatRendererAction,
  ChatRendererActionResult,
  ChatRendererSnapshot,
} from "../../extensions/chat-renderer";
import type { CommandRef } from "./commands";
import type { RendererCallback } from "./context";
import type { JsonObject } from "./json";
import type { RendererContributionBase } from "./renderer-base";

export type {
  ChatAttachment,
  ChatDraft,
  ChatQueuedRequest,
  ChatRendererAction,
  ChatRendererActionResult,
  ChatRendererEvent,
  ChatRendererSnapshot,
} from "../../extensions/chat-renderer";

/** Host-native conversation. Extensions supply only serializable state and scoped command handlers. */
export interface ChatRendererContribution extends RendererContributionBase {
  /** Fallback draft identity when the placement has no session/draft resource. Resource identity wins. */
  draftKey: string;
  /** Transition one legacy host Sessions draft after saving it through saveDraft. */
  legacySessionDraft?: boolean;
  /** Available on the first render, before any command or stream connects. */
  initial?: ChatRendererSnapshot;
  query: RendererCallback<JsonObject, ChatRendererSnapshot>;
  // biome-ignore lint/suspicious/noConfusingVoidType: side-effect-only callbacks may infer Promise<void>.
  onAction: RendererCallback<{ action: ChatRendererAction; draftKey: string }, ChatRendererActionResult | void>;
  resolveLink?: RendererCallback<{ candidate: ChatLinkCandidate }, ChatLinkPresentation>;
  resolveImage?: RendererCallback<{ source: string }, string | null>;
  /** A normal cancellable command that writes ChatRendererEvent chunks; abort must release holds, never stop work. */
  stream?: CommandRef;
  loadDraft?: RendererCallback<{ draftKey: string }, ChatDraft>;
  saveDraft?: RendererCallback<{ draftKey: string; draft: ChatDraft }, void>;
}
