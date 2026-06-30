import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { ChatMessagePart, SessionMessage } from "./message-types";

interface MessageActionPanelProps {
  message: SessionMessage;
  alwaysVisible?: boolean;
  copyAlwaysVisible?: boolean;
}

const isCopyablePart = (part: ChatMessagePart): part is Extract<ChatMessagePart, { type: "text" }> => {
  return part.type === "text";
};

export const getMessageCopyText = (message: SessionMessage) => {
  return (message.parts ?? [])
    .filter(isCopyablePart)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
};

export const getMessageTimestampLabel = (message: SessionMessage, locale?: string, timeZone?: string) => {
  if (!message.createdAt) return "";

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(message.createdAt));
};

export const MessageActionPanel = (props: MessageActionPanelProps) => {
  const { message, alwaysVisible = false, copyAlwaysVisible = alwaysVisible } = props;
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const copyText = getMessageCopyText(message);
  const timestampLabel = getMessageTimestampLabel(message);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const copyMessage = async () => {
    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      setIsCopied(true);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => setIsCopied(false), 1200);
    } catch {
      setIsCopied(false);
    }
  };

  if (!copyText && !timestampLabel) return null;

  return (
    <HStack
      data-chat-message-action-panel="true"
      gap="2xs"
      minH="6"
      opacity={alwaysVisible ? "1" : "0"}
      pointerEvents={alwaysVisible ? "auto" : "none"}
      transition="opacity 120ms ease"
      css={messageActionPanelHoverStyles}
    >
      {timestampLabel ? (
        <Text textStyle="label/XS/regular" color="fg.muted">
          {timestampLabel}
        </Text>
      ) : null}
      {copyText ? (
        <Box
          opacity={copyAlwaysVisible ? "1" : "0"}
          pointerEvents={copyAlwaysVisible ? "auto" : "none"}
          transition="opacity 120ms ease"
          css={messageActionPanelHoverStyles}
        >
          <Tooltip content={isCopied ? "Copied" : "Copy message"}>
            <IconButton
              aria-label={isCopied ? "Copied" : "Copy message"}
              variant="ghost"
              size="2xs"
              onClick={copyMessage}
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
    </HStack>
  );
};

const messageActionPanelHoverStyles = {
  "[data-chat-message-with-actions]:hover &, [data-chat-message-with-actions]:focus-within &": {
    opacity: 1,
    pointerEvents: "auto",
  },
  ".ai-message__root:hover &, .ai-message__root:focus-within &": {
    opacity: 1,
    pointerEvents: "auto",
  },
  "[data-scope='ai-message'][data-part='root']:hover &, [data-scope='ai-message'][data-part='root']:focus-within &": {
    opacity: 1,
    pointerEvents: "auto",
  },
};
