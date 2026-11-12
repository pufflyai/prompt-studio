import { Badge, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { AtSign, Bot, X } from "lucide-react";
import { useState } from "react";
import { Activity } from "@/components/activity";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { agents, author, type ReviewDraft } from "./review-fixtures";

interface CommentComposerProps {
  draft: ReviewDraft;
  onChange: (draft: ReviewDraft) => void;
  onSubmit: () => void;
}

export function CommentComposer({ draft, onChange, onSubmit }: CommentComposerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Stack gap="xs" data-activity-composer>
      {draft.quote && (
        <HStack align="start" justify="space-between">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            “{draft.quote}”
          </Text>
          <IconButton
            variant="ghost"
            size="2xs"
            aria-label="Remove quote"
            onClick={() => onChange({ ...draft, quote: undefined })}
          >
            <X />
          </IconButton>
        </HStack>
      )}
      <Activity.Composer
        actor={author}
        variant={draft.threadId ? "inline" : "standalone"}
        value={draft.text}
        placeholder={draft.threadId ? "Leave a reply…" : "Leave a comment, @ to ask an agent…"}
        submitLabel={draft.target ? "Review and send" : "Submit comment"}
        onChange={(text) => {
          onChange({ ...draft, text });
          if (text.endsWith("@")) setPickerOpen(true);
        }}
        onSubmit={onSubmit}
        onAttach={() => onChange({ ...draft, text: `${draft.text}\nAttached review-notes.md (sample)`.trim() })}
        actions={
          <>
            <SearchableMenu
              open={pickerOpen}
              onOpenChange={({ open }) => setPickerOpen(open)}
              trigger={
                <Button variant="ghost" size="2xs" type="button">
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
                },
              }))}
            />
            {draft.target && (
              <HStack minW="0" gap="0">
                <Badge variant="chip" minW="0">
                  <Text truncate>@{draft.target.handle}</Text>
                </Badge>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="2xs"
                  aria-label="Remove agent"
                  onClick={() => onChange({ ...draft, target: undefined })}
                >
                  <X />
                </IconButton>
              </HStack>
            )}
            {draft.threadId && (
              <Button type="button" size="2xs" variant="ghost" onClick={() => onChange({ text: "" })}>
                Cancel reply
              </Button>
            )}
          </>
        }
      />
    </Stack>
  );
}
