import { Badge, Button, HStack, Icon, Spacer, Stack, Text, Textarea } from "@chakra-ui/react";
import { CopyButton, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { Check, Lightbulb, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { Idea } from "../schemas";

interface DraftEditorProps {
  text: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}
export const DraftEditor = (props: DraftEditorProps) => {
  const { text, onSave, onCancel } = props;
  const [value, setValue] = useState(text);
  return (
    <Stack gap="xs">
      <Textarea aria-label="Draft" value={value} rows={5} onChange={(event) => setValue(event.target.value)} />
      <HStack gap="xs">
        <Button size="xs" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
          Save
        </Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </HStack>
    </Stack>
  );
};

interface ReplyIdeaProps {
  idea: Idea;
  onEdit: (body: string) => void;
  onStatus: (status: Idea["status"]) => void;
}
export const ReplyIdea = (props: ReplyIdeaProps) => {
  const { idea, onEdit, onStatus } = props;
  const [editing, setEditing] = useState(false);
  return (
    <SimpleCard bg="bg.subtle" aria-label="Reply idea">
      <SimpleCardBody>
        <Stack gap="sm">
          <HStack gap="xs">
            <Icon as={Lightbulb} boxSize="icon-xs" />
            <Badge size="sm" colorPalette="purple">
              {idea.status === "used" ? "Used" : "Reply idea"}
            </Badge>
            <Spacer />
            <Text textStyle="label/XS" color="fg.muted">
              Suggested {new Date(idea.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </HStack>
          {editing ? (
            <DraftEditor
              text={idea.body}
              onCancel={() => setEditing(false)}
              onSave={(body) => {
                onEdit(body);
                setEditing(false);
              }}
            />
          ) : (
            <Text textStyle="paragraph/S/regular" whiteSpace="pre-wrap">
              {idea.body}
            </Text>
          )}
          {editing ? null : (
            <HStack gap="2xs">
              <CopyButton size="xs" variant="ghost" text={idea.body} label="Copy reply" />
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              {idea.status === "used" ? null : (
                <Button size="xs" variant="ghost" onClick={() => onStatus("used")}>
                  <Check />
                  Mark used
                </Button>
              )}
              <Spacer />
              <Button size="xs" variant="ghost" onClick={() => onStatus("dismissed")}>
                <X />
                Dismiss
              </Button>
            </HStack>
          )}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
