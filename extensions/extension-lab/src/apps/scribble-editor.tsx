import { Editable, HStack, Stack } from "@chakra-ui/react";
import { AlertMessage, IconPicker, optionIcons, ScrollArea } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import type { ReactNode } from "react";

interface ScribbleEditorProps {
  id: string;
  title: string;
  icon: string;
  content: string;
  action?: ReactNode;
  error?: string;
  disabled?: boolean;
  onTitleChange(title: string): void;
  onIconChange(icon: string): void;
  onContentChange(content: string): void;
}

export const ScribbleEditor = (props: ScribbleEditorProps) => {
  const { id, title, icon, content, action, error, disabled, onTitleChange, onIconChange, onContentChange } = props;
  return (
    <ScrollArea h="full" bg="bg">
      <Stack maxW="3xl" mx="auto" px={{ base: "lg", md: "3xl" }} py="2xl" gap="xl">
        <HStack justify="space-between" align="start">
          <Stack gap="xs" minW="0">
            <HStack align="center" gap="md">
              <IconPicker
                value={icon}
                disabled={disabled}
                options={optionIcons.filter((option) => option.value !== null)}
                aria-label="Change page icon"
                onChange={(icon) => {
                  if (icon) onIconChange(icon);
                }}
              />
              <Editable.Root
                key={title}
                defaultValue={title}
                activationMode="click"
                disabled={disabled}
                onValueCommit={({ value }) => onTitleChange(value)}
              >
                <Editable.Preview aria-label="Rename page" />
                <Editable.Input aria-label="Page title" />
              </Editable.Root>
            </HStack>
          </Stack>
          {action}
        </HStack>
        {error ? <AlertMessage status="error" title={error} /> : null}
        <MarkdownEditor
          key={id}
          defaultState={content}
          fullWidth
          isEditable={!disabled}
          padding="0"
          scrollable={false}
          onChange={onContentChange}
        />
      </Stack>
    </ScrollArea>
  );
};
