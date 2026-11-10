import { type ChatLinkHandler, parseChatLink } from "@pstdio/ui/chat-ui";
import { chatLinkPresentationSchema } from "pstdio-api-contracts";
import { z } from "zod";
import type { ChatRecord } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";

export const createChatLinkHandler = (
  session: ChatSession,
  body: ChatRecord["body"],
  run: (id: string, params: Record<string, unknown>) => Promise<unknown>,
) => {
  return {
    resolveHref: (candidate) => {
      const link = parseChatLink(candidate, typeof window === "undefined" ? undefined : window.location.origin);
      // Opted-in host links own app validation and native external-tab/icon presentation.
      const hostLink = link?.kind === "page" || (link?.kind === "external" && /^https?:/i.test(link.href));
      if (hostLink && session.getSnapshot().conversation.nativeLinks) return null;
      return link?.kind === "external" || link?.kind === "page" ? link.href : null;
    },
    resolveResource: body.resolveLinkHandlerId
      ? async (candidate) => chatLinkPresentationSchema.parse(await run(body.resolveLinkHandlerId!, { candidate }))
      : undefined,
    resolveImageSource: body.resolveImageHandlerId
      ? async (source) =>
          z
            .string()
            .nullable()
            .parse(await run(body.resolveImageHandlerId!, { source }))
      : undefined,
    open: async (candidate) => {
      await session!.run({ type: "openLink", candidate }, (action) => run(body.actionHandlerId, { action }));
    },
  } satisfies ChatLinkHandler;
};
