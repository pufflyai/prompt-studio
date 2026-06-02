import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { FormEvent } from "react";
import { useLabStore } from "../store/lab-store";
import { LabCard } from "./lab-card";

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export const NotesCard = () => {
  const notes = useLabStore((state) => state.notes);
  const draft = useLabStore((state) => state.draft);
  const setDraft = useLabStore((state) => state.setDraft);
  const addNote = useLabStore((state) => state.addNote);
  const removeNote = useLabStore((state) => state.removeNote);
  const clearNotes = useLabStore((state) => state.clearNotes);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addNote(draft);
  };

  return (
    <LabCard title="Notes" subtitle="A scratch list backed by the same zustand store.">
      <Stack gap="md">
        <form onSubmit={onSubmit}>
          <HStack gap="sm">
            <Input
              placeholder="Jot something down..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="solid" disabled={!draft.trim()}>
              Add
            </Button>
          </HStack>
        </form>

        {notes.length === 0 ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            No notes yet.
          </Text>
        ) : (
          <Stack as="ul" gap="xs" padding="0" margin="0" listStyleType="none">
            {notes.map((note) => (
              <HStack
                as="li"
                key={note.id}
                justify="space-between"
                gap="sm"
                borderWidth="1px"
                borderColor="border"
                padding="sm"
              >
                <Box minW="0">
                  <Text textStyle="paragraph/S/regular" truncate>
                    {note.text}
                  </Text>
                  <Text textStyle="paragraph/XS/regular" color="fg.muted">
                    {formatTime(note.createdAt)}
                  </Text>
                </Box>
                <Button type="button" variant="ghost" size="xs" onClick={() => removeNote(note.id)}>
                  Remove
                </Button>
              </HStack>
            ))}
          </Stack>
        )}

        {notes.length > 0 ? (
          <HStack justify="flex-end">
            <Button type="button" variant="ghost" size="xs" onClick={clearNotes}>
              Clear all
            </Button>
          </HStack>
        ) : null}
      </Stack>
    </LabCard>
  );
};
