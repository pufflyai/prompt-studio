// Create a milestone with a date and an optional name. Existing milestones are edited in place.
import { Button, chakra, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { PlanClient } from "./use-plan";

interface DeadlineFormProps {
  client: PlanClient;
  initialDate?: string;
  onDone: () => void;
}

export function DeadlineForm(props: DeadlineFormProps) {
  const { client, initialDate, onDone } = props;
  const [date, setDate] = useState(initialDate ?? "");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await client.commands["timeline.deadline.create"]({ date, ...(name.trim() ? { name } : {}) });
      onDone();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="xs" p="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" bg="bg.subtle">
      <Flex gap="sm" align="end" wrap="wrap">
        <Stack gap="xs">
          <chakra.label htmlFor="deadline-date" textStyle="label/S/regular" color="fg.muted">
            Date
          </chakra.label>
          <Input
            id="deadline-date"
            type="date"
            size="sm"
            w="160px"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Stack>
        <Stack gap="xs" flex="1" minW="200px">
          <chakra.label htmlFor="deadline-name" textStyle="label/S/regular" color="fg.muted">
            Name (optional)
          </chakra.label>
          <Input
            id="deadline-name"
            size="sm"
            placeholder="Staging acceptance"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Stack>
        <Button size="sm" onClick={save} disabled={!date || saving} loading={saving}>
          Add milestone
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </Flex>
      {error ? (
        <Text role="alert" color="fg.error" textStyle="label/S/regular">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
