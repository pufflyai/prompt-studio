import type { ChatLinkProps } from "../links/chat-link";
import { buildTimelineDocFromInvocations } from "../tool-rendering";
import { normalizeToolName } from "../utils/tool-name";
import type { ToolPart } from "./message-types";
import { TimelineFromJSON } from "./timeline";

export interface ToolInvocationTimelineProps extends ChatLinkProps {
  invocations: ToolPart[];
  labeledBlocks?: boolean;
  hideQuestionForms?: boolean;
  /** @deprecated Use linkHandler. */
  onOpenFile?: (filePath: string) => void;
}

const isQuestionTool = (invocation: ToolPart) =>
  normalizeToolName(invocation.tool ?? "").replace(/_/g, "") === "question";

const hasToolOutput = (invocation: ToolPart) => {
  const output = invocation.state?.output;
  if (typeof output === "string") return output.trim().length > 0;
  if (Array.isArray(output)) return output.length > 0;
  if (output && typeof output === "object") return Object.keys(output).length > 0;
  return output !== undefined && output !== null;
};

export function ToolInvocationTimeline(props: ToolInvocationTimelineProps) {
  const { invocations, labeledBlocks, hideQuestionForms = false, onOpenFile, linkHandler } = props;
  const visibleInvocations = hideQuestionForms
    ? invocations.filter((invocation) => !isQuestionTool(invocation) || hasToolOutput(invocation))
    : invocations;

  if (visibleInvocations.length === 0) return null;

  const data = buildTimelineDocFromInvocations(visibleInvocations, { labeledBlocks });

  return <TimelineFromJSON data={data} linkHandler={linkHandler} onOpenFile={onOpenFile} />;
}
