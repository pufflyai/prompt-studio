import { Box, Spinner, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { AlertMessage } from "@/components/alert";
import { RichMessage } from "@/components/rich-text";
import type { AlertPart, ErrorPart, SessionMessage, SessionMessagePart, ToolPart } from "../agent-types";
import { Response } from "./ai-response";
import { ToolInvocationTimeline, type ToolInvocationTimelineProps } from "./tool-invocation-timeline";

type ToolInvocationTimelineComponent = (props: ToolInvocationTimelineProps) => ReactNode;

export interface MessagePartsProps {
  message: SessionMessage;
  streaming?: boolean;
  hideQuestionForms?: boolean;
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

const ALERT_COLOR_PALETTE: Record<AlertPart["status"], string> = {
  info: "blue",
  warning: "orange",
  error: "red",
  success: "green",
  loading: "blue",
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
      case "error":
        nodes.push(
          <Box key={key} py="2" width="full">
            <AlertMessage borderRadius="xs" status="error" colorPalette="red" title={getErrorMessage(part)} size="sm" />
          </Box>,
        );
        break;
      case "token_usage":
        nodes.push(
          <Box key={key}>
            <Text fontSize="xs" color="fg.subtle">
              Tokens: {formatTokenCount(part.inputTokens)} in / {formatTokenCount(part.outputTokens)} out
              {part.cacheReadTokens ? ` / ${formatTokenCount(part.cacheReadTokens)} cache read` : ""}
            </Text>
          </Box>,
        );
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
