import { Box, Icon } from "@chakra-ui/react";
import { ResourceBadge } from "@/components/primitives/resource-badge";
import { resolveIconComponent } from "@/utils/resolve-icon-component";
import type { ChatLinkCandidate } from "./chat-link";
import { ChatLinkAnchor } from "./chat-link-anchor";
import { useChatLinkHandler } from "./chat-link-context";
import { useChatResource } from "./use-chat-resource";

export const ChatResourceLink = (props: { candidate: ChatLinkCandidate; label: string }) => {
  const { candidate, label } = props;
  const handler = useChatLinkHandler();
  const presentation = useChatResource(candidate);
  const ResourceIcon = presentation?.icon ? resolveIconComponent(presentation.icon) : undefined;
  return (
    <Box as="span" display="inline-block" verticalAlign="middle" maxW="full">
      <ChatLinkAnchor
        candidate={candidate}
        resolvedHref={presentation ? presentation.href : (handler?.resolveHref(candidate) ?? null)}
      >
        <ResourceBadge
          fileName={presentation?.label ?? label}
          icon={ResourceIcon ? <Icon as={ResourceIcon} boxSize="3" aria-hidden /> : undefined}
          tooltip={false}
          size="sm"
          cursor="pointer"
        />
      </ChatLinkAnchor>
    </Box>
  );
};
