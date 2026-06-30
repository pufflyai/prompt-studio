import { Box, Image, Spinner } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { ResourceBadge } from "@/components/primitives/resource-badge";
import { RichMessage } from "@/components/rich-text";
import { Response } from "./ai-response";
import type { AlertPart, ChatMessagePart, ErrorPart, FilePart, SessionMessage, ToolPart } from "./message-types";
import { ToolInvocationTimeline, type ToolInvocationTimelineProps } from "./tool-invocation-timeline";

type ToolInvocationTimelineComponent = (props: ToolInvocationTimelineProps) => ReactNode;

export interface MessagePartsProps {
  message: SessionMessage;
  streaming?: boolean;
  hideQuestionForms?: boolean;
  onOpenFile?: (filePath: string) => void;
  toolInvocationTimeline?: ToolInvocationTimelineComponent;
}

const isToolPart = (part: ChatMessagePart): part is ToolPart => {
  return part.type === "tool";
};

const filePartLabel = (part: FilePart) => part.filename ?? part.url.split("/").pop() ?? "attachment";

const imageExtensionPattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

const isImageFilePart = (part: FilePart) =>
  part.mediaType?.startsWith("image/") || imageExtensionPattern.test(filePartLabel(part));

const filePartThumbnail = (part: FilePart) =>
  isImageFilePart(part) ? (
    <Image
      src={part.url}
      alt={`${filePartLabel(part)} preview thumbnail`}
      boxSize="18px"
      borderRadius="xs"
      objectFit="cover"
    />
  ) : undefined;

const openFilePart = (part: FilePart, onOpenFile?: (filePath: string) => void) => {
  if (onOpenFile) {
    onOpenFile(part.url);
    return;
  }

  if (typeof window !== "undefined") {
    window.open(part.url, "_blank", "noopener,noreferrer");
  }
};

const getErrorMessage = (part: ErrorPart) => {
  if (part.message && part.message.trim().length > 0) {
    return part.message;
  }

  const { errorType } = part;
  switch (errorType) {
    case "timeout":
      return "Session timed out.";
    case "crash":
      return "Session crashed unexpectedly.";
    case "permission":
      return "Permission denied.";
    default:
      return "An error occurred.";
  }
};

const ALERT_COLOR_PALETTE: Record<AlertPart["status"], string> = {
  info: "blue",
  warning: "orange",
  error: "red",
  success: "green",
  loading: "blue",
};

const collectToolInvocations = (parts: ChatMessagePart[], startIndex: number) => {
  const invocations: ToolPart[] = [];
  let lookahead = startIndex;

  while (lookahead < parts.length) {
    const nextPart = parts[lookahead];
    if (!isToolPart(nextPart)) break;
    invocations.push(nextPart);
    lookahead += 1;
  }

  return { invocations, nextIndex: lookahead - 1 };
};

export function MessagePartsRenderer(props: MessagePartsProps) {
  const { message, hideQuestionForms = false, onOpenFile, toolInvocationTimeline } = props;
  const RenderToolInvocationTimeline = toolInvocationTimeline ?? ToolInvocationTimeline;
  const parts = message.parts ?? [];
  const nodes: ReactNode[] = [];

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex];
    const key = `${message.id}-${partIndex}`;

    switch (part.type) {
      case "text":
        nodes.push(
          <div key={key}>
            <Response>{part.text}</Response>
          </div>,
        );
        break;
      case "reasoning":
        nodes.push(
          <Box
            key={key}
            padding="0"
            css={{
              "& .rich-text, & .rich-text *": {
                color: "fg.subtle !important",
                fontSize: ".75rem !important",
                fontWeight: "normal !important",
              },
            }}
          >
            <RichMessage defaultState={part.text} fullWidth />
          </Box>,
        );
        break;
      case "tool": {
        const { invocations, nextIndex } = collectToolInvocations(parts, partIndex);
        partIndex = nextIndex;
        nodes.push(
          <Box key={key} width="full">
            <RenderToolInvocationTimeline
              invocations={invocations}
              labeledBlocks
              hideQuestionForms={hideQuestionForms}
              onOpenFile={onOpenFile}
            />
          </Box>,
        );
        break;
      }
      case "file":
        nodes.push(
          <Box key={key} width="fit-content">
            <ResourceBadge
              fileName={filePartLabel(part)}
              size="sm"
              tone="neutral"
              icon={filePartThumbnail(part)}
              onSelect={() => openFilePart(part, onOpenFile)}
            />
          </Box>,
        );
        break;
      case "error":
        nodes.push(
          <Box key={key} py="2" width="full">
            <AlertMessage borderRadius="xs" status="error" colorPalette="red" title={getErrorMessage(part)} size="sm" />
          </Box>,
        );
        break;
      case "token_usage":
        break;
      case "alert":
        nodes.push(
          <Box key={key} width="full">
            <AlertMessage
              borderRadius="xs"
              status={part.status === "loading" ? "info" : part.status}
              colorPalette={ALERT_COLOR_PALETTE[part.status]}
              title={part.title}
              icon={part.status === "loading" ? <Spinner size="sm" /> : undefined}
              size="sm"
            >
              {part.message}
            </AlertMessage>
          </Box>,
        );
        break;
      default:
        nodes.push(null);
    }
  }

  return <>{nodes}</>;
}
