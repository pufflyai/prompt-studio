import { chakra, Stack, useRecipe } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { chatQuestionBubbleRecipe } from "@/theme/recipes/chat-question-bubble";
import {
  getQuestionBubbleAnswer,
  getQuestionRequestKey,
  isPendingQuestion,
  parseQuestionPrompt,
} from "../tool-rendering/question-prompt";
import { useQuestionNavigation } from "./chat-question-navigation";
import type { ToolPart } from "./message-types";

interface ChatQuestionBubbleProps {
  part: ToolPart;
}

export const ChatQuestionBubble = (props: ChatQuestionBubbleProps) => {
  const { part } = props;
  const prompt = parseQuestionPrompt(part.state?.input);
  const navigation = useQuestionNavigation();
  const recipe = useRecipe({ recipe: chatQuestionBubbleRecipe });
  if (!prompt) return null;
  const pending = isPendingQuestion(part);
  const canOpen = pending && Boolean(navigation);
  return (
    <Stack gap="xs" align="start">
      {prompt.questions.map((question, index) => {
        const answer = getQuestionBubbleAnswer(part, index) ?? question.options[0]?.label ?? "Your answer";
        const expanded =
          navigation?.activeKey === getQuestionRequestKey(part) && navigation?.selection?.index === index;
        return (
          <chakra.button
            key={question.id}
            type="button"
            css={recipe({ multiline: question.question.includes("\n") })}
            data-state={pending ? "pending" : "answered"}
            disabled={!canOpen}
            aria-expanded={canOpen ? expanded : undefined}
            aria-label={`${question.question} → ${answer}${canOpen ? ". Open question" : ""}`}
            onClick={() => navigation?.open(part, index)}
          >
            <span data-question-text>{question.question}</span>
            <span data-question-answer-row>
              <ArrowRight aria-hidden="true" />
              <span data-question-answer>{answer}</span>
            </span>
          </chakra.button>
        );
      })}
    </Stack>
  );
};
