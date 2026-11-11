import { Badge, Button, HStack, IconButton, Stack, Text, Textarea } from "@chakra-ui/react";
import { AtSign, Bot, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { agents, type ReviewDraft } from "./review-fixtures";

interface CommentComposerProps {
  draft: ReviewDraft;
  onChange: (draft: ReviewDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CommentComposer(props: CommentComposerProps) {
  const { draft, onChange, onSubmit, onCancel } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <Stack gap="sm" p="sm" borderWidth="1px" borderColor="border" borderRadius="xs">
      <Text textStyle="label/M/medium">{draft.threadId ? "Reply" : "New comment"}</Text>
      {!draft.threadId && (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          “{draft.quote}”
        </Text>
      )}
      <Textarea
        ref={input}
        aria-label="Comment"
        placeholder="Write a comment, @ to ask an agent…"
        value={draft.text}
        onChange={(event) => {
          const text = event.target.value;
          onChange({ ...draft, text });
          if (text.endsWith("@")) setPickerOpen(true);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
          if (event.key === "Escape" && !pickerOpen) onCancel();
        }}
      />
      {draft.target && (
        <HStack minW="0">
          <Badge variant="chip" minW="0" maxW="full">
            <Text truncate>@{draft.target.handle}</Text>
          </Badge>
          <IconButton
            variant="ghost"
            size="2xs"
            aria-label="Remove agent"
            onClick={() => onChange({ ...draft, target: undefined })}
          >
            <X />
          </IconButton>
        </HStack>
      )}
      <HStack justify="space-between" flexWrap="wrap">
        <SearchableMenu
          open={pickerOpen}
          onOpenChange={({ open }) => setPickerOpen(open)}
          trigger={
            <Button variant="ghost" size="xs">
              <AtSign />
              Agent
            </Button>
          }
          searchPlaceholder="Find an agent or model"
          emptyState={<Text p="sm">No matching agents</Text>}
          items={agents.map((target) => ({
            id: target.harnessId,
            label: `@${target.handle}`,
            icon: Bot,
            secondaryLabel: target.available ? undefined : "Not installed",
            isDisabled: !target.available,
            isSelected: draft.target?.harnessId === target.harnessId,
            onSelect: () => {
              onChange({ ...draft, target, text: draft.text.replace(/@$/, "") });
              setPickerOpen(false);
              input.current?.focus();
            },
          }))}
        />
        <HStack gap="xs">
          <Button size="xs" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="xs" variant="primary" disabled={!draft.text.trim()} onClick={onSubmit}>
            <Send />
            {draft.target ? "Review and send" : "Comment"}
          </Button>
        </HStack>
      </HStack>
    </Stack>
  );
}
