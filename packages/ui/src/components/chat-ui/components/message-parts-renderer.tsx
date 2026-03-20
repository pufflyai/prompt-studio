import { Box, Spinner, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { RichMessage } from "@/components/rich-text";
import type { ErrorPart, SessionMessage, SessionMessagePart, ToolPart } from "../agent-types";
import { Response } from "./ai-response";
import { ToolInvocationTimeline, type ToolInvocationTimelineProps } from "./tool-invocation-timeline";

type ToolInvocationTimelineComponent = (props: ToolInvocationTimelineProps) => ReactNode;

export interface MessagePartsProps {
  message: SessionMessage;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
  toolInvocationTimeline?: ToolInvocationTimelineComponent;
}

const isToolPart = (part: SessionMessagePart): part is ToolPart => {
  return part.type === "tool";
};

const formatTokenCount = (count: number) => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
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

const collectToolInvocations = (parts: SessionMessagePart[], startIndex: number) => {
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
  const { message, onOpenFile, toolInvocationTimeline } = props;
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
            <RenderToolInvocationTimeline invocations={invocations} labeledBlocks onOpenFile={onOpenFile} />
          </Box>,
        );
        break;
      }
      case "loading":
        nodes.push(
          <Box key={key} display="flex" alignItems="center" gap="2" py="2">
            <Spinner size="sm" />
            <Text fontSize="sm" color="fg.muted">
              Thinking...
            </Text>
          </Box>,
        );
        break;
      case "error":
        nodes.push(
          <Box key={key} py="2">
            <Text fontSize="sm" color="fg.error">
              {getErrorMessage(part)}
            </Text>
          </Box>,
        );
        break;
      case "token_usage":
        nodes.push(
          <Box key={key} py="1">
            <Text fontSize="xs" color="fg.subtle">
              Tokens: {formatTokenCount(part.inputTokens)} in / {formatTokenCount(part.outputTokens)} out
              {part.cacheReadTokens ? ` / ${formatTokenCount(part.cacheReadTokens)} cache read` : ""}
            </Text>
          </Box>,
        );
        break;
      default:
        nodes.push(null);
    }
  }

  return <>{nodes}</>;
}
