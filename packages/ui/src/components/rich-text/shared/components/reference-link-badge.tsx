import { Box } from "@chakra-ui/react";
import { ChatLinkAnchor } from "@/components/chat-ui/links/chat-link-anchor";
import { useChatLinkHandler } from "@/components/chat-ui/links/chat-link-context";
import { ChatResourceLink } from "@/components/chat-ui/links/chat-resource-link";
import { ResourceBadge } from "@/components/primitives/resource-badge";

export const ReferenceLinkBadge = (props: { href: string }) => {
  const { href } = props;
  const handler = useChatLinkHandler();
  const candidate = { source: href, origin: "reference" as const };
  const label = href.split("/").pop() || "unknown";
  if (handler) return <ChatResourceLink candidate={candidate} label={label} />;
  return (
    <Box width="fit-content" display="inline-block">
      <ChatLinkAnchor candidate={candidate}>
        <ResourceBadge
          fileName={label}
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
