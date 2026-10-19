import { Box, Link } from "@chakra-ui/react";
import { isChatWebLink, parseChatLink } from "@/components/chat-ui/links/chat-link";
import { ChatLinkAnchor } from "@/components/chat-ui/links/chat-link-anchor";
import { useChatLinkHandler } from "@/components/chat-ui/links/chat-link-context";
import { ChatResourceLink } from "@/components/chat-ui/links/chat-resource-link";
import { ChatWebLink } from "@/components/chat-ui/links/chat-web-link";
import { ResourceBadge } from "@/components/primitives/resource-badge";

// `target` is the reference as written. `href` encodes relative targets for the editor (`#path`).
export const ReferenceLinkBadge = (props: { href: string; target: string }) => {
  const { href, target } = props;
  const handler = useChatLinkHandler();
  const candidate = { source: target, origin: "reference" as const };
  const label = target.split("/").pop() || "unknown";
  if (isChatWebLink(handler, candidate)) return <ChatWebLink source={target} label={label} />;
  const parsed = parseChatLink(candidate, typeof window === "undefined" ? undefined : window.location.origin);
  if (parsed?.kind === "external")
    return (
      <Link
        href={parsed.href}
        variant="resource"
        target={/^https?:/i.test(parsed.href) ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        <ResourceBadge fileName={label} size="sm" tooltip={false} cursor="pointer" />
      </Link>
    );
  if (handler) return <ChatResourceLink candidate={candidate} label={label} />;
  return (
    <Box width="fit-content" display="inline-block">
      <ChatLinkAnchor candidate={candidate}>
        <ResourceBadge
          fileName={label}
          tooltip={false}
          onSelect={() => {
            if (/^https?:\/\//i.test(href)) {
              window.open(href, "_blank", "noopener,noreferrer");
            } else if (/^#?\$PROJECT\//i.test(href)) {
              window.dispatchEvent(
                new CustomEvent("ui:open-project-file", { detail: href.replace(/^#?\$PROJECT\//i, "") }),
              );
            } else {
              window.location.assign(href);
            }
          }}
        />
      </ChatLinkAnchor>
    </Box>
  );
};
