// Submit one action and retain draft answers if the server refuses the write.
import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ActionResponse, TicketAction } from "../model/action-types";
import { Instructions } from "./instructions";
import { QuestionField } from "./question-field";
import type { PlanClient } from "./use-plan";

interface ActionFormProps {
  action: TicketAction;
  ticket: string;
  client: PlanClient;
  completed: boolean;
}

export function ActionForm(props: ActionFormProps) {
  const { action, ticket, client, completed } = props;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    setSaving(true);
    setError(undefined);
    const response: ActionResponse = action.request.kind === "task" ? { confirmed: true } : { answers };
    try {
      await client.commands["timeline.action.resolve"]({
        ticket,
        actionId: action.id,
        expectedRevision: action.revision,
        response,
      });
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm" p="sm" bg="bg.subtle" borderRadius="md">
      <Text textStyle="label/M/medium">{action.title}</Text>
      <Instructions text={action.instructions} />
      {action.cancellation ? <Text color="fg.muted">Cancelled: {action.cancellation.reason}</Text> : null}
      {action.resolution ? <SavedResponse action={action} /> : null}
      {!action.resolution && !action.cancellation ? (
        <Stack gap="sm">
          {action.request.kind === "decision"
            ? action.request.questions.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  prefix={action.id}
                  value={answers[question.id]}
                  disabled={saving || completed}
                  onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                />
              ))
            : null}
          {completed ? (
            <Text color="fg.muted">This ticket is complete.</Text>
          ) : (
            <Button size="sm" loading={saving} disabled={saving} onClick={() => void save()}>
              {action.request.kind === "task" ? "Confirm completed" : "Submit answer"}
            </Button>
          )}
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

function SavedResponse(props: { action: TicketAction }) {
  const { action } = props;
  const response = action.resolution?.response;
  const label = (questionId: string, value: string | string[]) => {
    const question =
      action.request.kind === "decision" ? action.request.questions.find(({ id }) => id === questionId) : undefined;
    const text = (Array.isArray(value) ? value : [value])
      .map((id) => question?.options?.find((option) => option.id === id)?.label ?? id)
      .join(", ");
    return `${question?.label ?? questionId}: ${text}`;
  };

  return (
    <Stack gap="xs">
      <Text color="green.fg" textStyle="label/S/medium">
        Resolved
      </Text>
      {response && "answers" in response ? (
        Object.entries(response.answers).map(([id, value]) => (
          <Text key={id} textStyle="label/S/regular">
            {label(id, value)}
          </Text>
        ))
      ) : (
        <Text textStyle="label/S/regular">Completion confirmed</Text>
      )}
    </Stack>
  );
}
