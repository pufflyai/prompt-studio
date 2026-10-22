import { Box, Icon, Image, Link } from "@chakra-ui/react";
import { Globe } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { ResourceBadge } from "@/components/primitives/resource-badge";
import { resolveMarkdownUrl } from "@/components/rich-text/shared/markdown-url";
import { ChatLinkStreamingContext, useChatLinkHandler } from "./chat-link-context";

interface ChatWebLinkProps {
  source: string;
  label: string;
}

const SiteIcon = (props: { href: string }) => {
  const { href } = props;
  const handler = useChatLinkHandler();
  const streaming = useContext(ChatLinkStreamingContext);
  const [icon, setIcon] = useState<{ href: string; src: string | null }>();
  const [failedSrc, setFailedSrc] = useState<string>();
  useEffect(() => {
    if (streaming) return;
    let active = true;
    const show = (src: string | null) => {
      if (active) setIcon({ href, src });
    };
    void handler?.resolveIcon?.(href).then(show, () => show(null));
    return () => {
      active = false;
    };
  }, [handler, href, streaming]);
  const src = icon?.href === href ? icon.src : null;
  if (!src || src === failedSrc) return <Icon as={Globe} boxSize="3" aria-hidden />;
  return <Image src={src} alt="" boxSize="3" onError={() => setFailedSrc(src)} />;
};

// Web links keep a native anchor, so new tabs, modified clicks and the desktop window-open handler still work.
// The badge stops the click before Lexical's ClickableLinkPlugin, which would call window.open without noopener.
export const ChatWebLink = (props: ChatWebLinkProps) => {
  const { source, label } = props;
  const href = resolveMarkdownUrl(source, "link");
  if (!href) return label;
  return (
    <Box as="span" display="inline-block" verticalAlign="middle" maxW="full">
      <Link variant="resource" href={href} target="_blank" rel="noopener noreferrer">
        <ResourceBadge fileName={label} icon={<SiteIcon href={href} />} tooltip={false} size="sm" cursor="pointer" />
      </Link>
    </Box>
  );
};
