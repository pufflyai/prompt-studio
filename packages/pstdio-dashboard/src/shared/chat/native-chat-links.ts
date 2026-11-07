import type { ChatLinkHandler } from "@pstdio/ui/chat-ui";

/** Host resolution is an explicit fallback. A provider's custom URI and image callbacks retain priority. */
export const composeNativeChatLinks = (
  provider: ChatLinkHandler | undefined,
  host: ChatLinkHandler,
): ChatLinkHandler => ({
  resolveHref: (candidate) => provider?.resolveHref(candidate) ?? host.resolveHref(candidate),
  resolveResource: async (candidate) =>
    (await provider?.resolveResource?.(candidate)) ?? (await host.resolveResource?.(candidate)) ?? null,
  resolveImageSource: async (source) =>
    (await provider?.resolveImageSource?.(source)) ?? (await host.resolveImageSource?.(source)) ?? null,
  resolveIcon: async (href) => (await provider?.resolveIcon?.(href)) ?? (await host.resolveIcon?.(href)) ?? null,
  describe: (candidate) => provider?.describe?.(candidate) ?? host.describe?.(candidate) ?? `Open ${candidate.source}`,
  open: async (candidate) => {
    if (await provider?.resolveResource?.(candidate)) return provider?.open(candidate);
    return host.open(candidate);
  },
});
