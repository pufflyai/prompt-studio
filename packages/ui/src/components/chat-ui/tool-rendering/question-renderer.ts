import type { ToolPart } from "../components/message-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
import { hasQuestionResponse, parseQuestionPrompt } from "./question-prompt";
import type { ToolRenderer } from "./types";

type QuestionRendererDependencies = {
  buildBaseTitle: (invocation: ToolPart, detail?: string, labelOverride?: string) => TitleSegment[];
  buildIndicator: (invocation: ToolPart) => Item["indicator"];
  prependErrorBlock: (invocation: ToolPart, blocks: Block[]) => Block[];
};

export const createQuestionRenderer = (deps: QuestionRendererDependencies): ToolRenderer => {
  const { buildBaseTitle, buildIndicator, prependErrorBlock } = deps;

  return (invocation) => {
    const responded = hasQuestionResponse(invocation.state?.output) || hasQuestionResponse(invocation.state?.metadata);
    const prompt = parseQuestionPrompt(invocation.state?.input);
    const block = prompt ? ({ type: "question-form", questions: prompt.questions } satisfies Block) : null;
    if (!responded && !block) return null;

    const fieldLabel = block ? `${block.questions.length} field${block.questions.length === 1 ? "" : "s"}` : undefined;
    const blocks = responded ? [] : [block!];

    return {
      indicator: buildIndicator(invocation),
      title: buildBaseTitle(invocation, fieldLabel, "Question"),
      blocks: prependErrorBlock(invocation, blocks),
      expandable: false,
    } satisfies Item;
  };
};
