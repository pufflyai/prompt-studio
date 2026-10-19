import { Box, Icon } from "@chakra-ui/react";
import { ResourceBadge } from "@/components/primitives/resource-badge";
import { getFileTypeIcon } from "@/utils/get-file-type-icon";
import { resolveIconComponent } from "@/utils/resolve-icon-component";
import { ChatGuessText } from "./chat-guess-text";
import { type ChatLinkCandidate, isGuessedChatLink, parseChatLink } from "./chat-link";
import { ChatLinkAnchor } from "./chat-link-anchor";
import { useChatLinkHandler } from "./chat-link-context";
import { useChatResource } from "./use-chat-resource";

interface ChatResourceLinkProps {
  candidate: ChatLinkCandidate;
  label: string;
  format?: number;
}

export const ChatResourceLink = (props: ChatResourceLinkProps) => {
  const { candidate, label, format = 0 } = props;
  const handler = useChatLinkHandler();
  const presentation = useChatResource(candidate);
  if (!presentation && isGuessedChatLink(candidate)) return <ChatGuessText text={label} format={format} />;
  const parsed = parseChatLink(candidate);
  const ownerIcon = presentation?.icon ? resolveIconComponent(presentation.icon) : undefined;
  const ResourceIcon = ownerIcon ?? getFileTypeIcon(parsed?.kind === "file" ? parsed.path : label);
  return (
    <Box as="span" display="inline-block" verticalAlign="middle" maxW="full">
      <ChatLinkAnchor
        candidate={candidate}
        resolvedHref={presentation ? presentation.href : (handler?.resolveHref(candidate) ?? null)}
      >
        <ResourceBadge
          fileName={presentation?.label ?? label}
          icon={<Icon as={ResourceIcon} boxSize="3" aria-hidden />}
          tooltip={false}
          size="sm"
          cursor="pointer"
        />
      </ChatLinkAnchor>
    </Box>
  );
};
