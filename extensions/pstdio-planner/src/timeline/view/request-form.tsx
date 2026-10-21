// Answer one review request and keep draft answers visible if the server refuses the write.
import { Button, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { QuestionPromptControls, useQuestionPromptState } from "@pstdio/ui/chat-ui";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReviewRequestView, ReviewResponse } from "../../data/review-request-types";
import { Instructions } from "./instructions";
import { toQuestionPrompt, toResponseAnswers, toSavedPromptState } from "./review-question-prompt";

export interface RequestHandlers {
  onAnswer: (requestId: string, response: ReviewResponse) => Promise<unknown>;
  onOpenChat: (requestId: string) => Promise<unknown>;
}

interface RequestFormProps extends RequestHandlers {
  request: ReviewRequestView;
}

export function RequestForm(props: RequestFormProps) {
  const { request, onAnswer, onOpenChat } = props;
  const questions = request.request.kind === "decision" ? request.request.questions : [];
  const [prompt] = useState(() => toQuestionPrompt(request.id, questions));
  const form = useQuestionPromptState(prompt);
  const [saved] = useState(() =>
    toSavedPromptState(
      request.id,
      questions,
      request.outcome?.kind === "answered" ? request.outcome.response : undefined,
    ),
  );
  const restore = useRef(form.restore).current;
  useEffect(() => restore(saved.selected, saved.custom), [restore, saved]);
  const [pending, setPending] = useState<"answer" | "chat">();
  const [error, setError] = useState<string>();
  const run = async (kind: "answer" | "chat", write: () => Promise<unknown>) => {
    setPending(kind);
    setError(undefined);
    try {
      await write();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(undefined);
    }
  };
  const response = () =>
    request.request.kind === "task"
      ? { confirmed: true as const }
      : { answers: toResponseAnswers(questions, form.buildAnswers()) };
  const decisionAction = request.state === "answered" ? "Update answer" : "Submit answer";

  return (
    <Stack gap="sm" p="sm" bg="bg.subtle" borderRadius="md">
      <Text textStyle="label/M/medium">{request.title}</Text>
      <Instructions text={request.instructions} />
      {request.state === "cancelled" ? <Text color="fg.muted">{request.outcomeText}</Text> : null}
      {request.state === "answered" ? (
        <Stack gap="xs">
          <Text color="green.fg" textStyle="label/S/medium">
            Answered
          </Text>
          {request.request.kind === "task" ? <Text textStyle="label/S/regular">{request.outcomeText}</Text> : null}
        </Stack>
      ) : null}
      {request.state === "open" || (request.state === "answered" && request.request.kind === "decision") ? (
        <Stack gap="sm">
          {questions.length ? (
            <QuestionPromptControls
              isEditable={pending === undefined}
              questionPrompt={prompt}
              selectedOptionsByQuestion={form.selectedOptionsByQuestion}
              customAnswersByQuestion={form.customAnswersByQuestion}
              onToggleOption={form.toggleOption}
              onToggleOther={form.toggleOther}
              onCustomAnswerChange={form.setCustomAnswer}
            />
          ) : null}
          <Flex gap="xs" wrap="wrap">
            <Button
              size="sm"
              loading={pending === "answer"}
              disabled={pending !== undefined || form.hasMissingRequiredAnswer}
              onClick={() => void run("answer", () => onAnswer(request.id, response()))}
            >
              {request.request.kind === "task" ? "Confirm completed" : decisionAction}
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={pending === "chat"}
              disabled={pending !== undefined}
              onClick={() => void run("chat", () => onOpenChat(request.id))}
            >
              <Icon as={MessageSquare} />
              Open session
            </Button>
          </Flex>
        </Stack>
      ) : null}
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
