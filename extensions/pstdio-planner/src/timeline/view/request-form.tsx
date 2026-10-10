// Answer one review request and keep draft answers visible if the server refuses the write.
import { Button, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import type { ReviewRequestView, ReviewResponse } from "../../data/review-request-types";
import { Instructions } from "./instructions";
import { QuestionField } from "./question-field";

export interface RequestHandlers {
  onAnswer: (requestId: string, response: ReviewResponse) => Promise<unknown>;
  onOpenChat: (requestId: string) => Promise<unknown>;
}

interface RequestFormProps extends RequestHandlers {
  request: ReviewRequestView;
}

export function RequestForm(props: RequestFormProps) {
  const { request, onAnswer, onOpenChat } = props;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
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
  const response: ReviewResponse = request.request.kind === "task" ? { confirmed: true } : { answers };

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
          <Text textStyle="label/S/regular" whiteSpace="pre-wrap">
            {request.outcomeText}
          </Text>
        </Stack>
      ) : null}
      {request.state === "open" ? (
        <Stack gap="sm">
          {request.request.kind === "decision"
            ? request.request.questions.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  prefix={request.id}
                  value={answers[question.id]}
                  disabled={pending !== undefined}
                  onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                />
              ))
            : null}
          <Flex gap="xs" wrap="wrap">
            <Button
              size="sm"
              loading={pending === "answer"}
              disabled={pending !== undefined}
              onClick={() => void run("answer", () => onAnswer(request.id, response))}
            >
              {request.request.kind === "task" ? "Confirm completed" : "Submit answer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={pending === "chat"}
              disabled={pending !== undefined}
              onClick={() => void run("chat", () => onOpenChat(request.id))}
            >
              <Icon as={MessageSquare} />
              Open chat
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
