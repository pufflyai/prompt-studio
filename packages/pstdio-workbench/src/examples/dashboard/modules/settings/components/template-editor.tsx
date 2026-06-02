import { Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import type { DashboardTemplate } from "../settings-data";

interface TemplateEditorProps {
  template: DashboardTemplate;
  onSave: (content: string) => void;
  onDelete: () => void;
}

// Per-template editor for the Templates collection. Keyed by template id at the
// call site so local edit state resets when a different template opens.
export const TemplateEditor = (props: TemplateEditorProps) => {
  const { template, onSave, onDelete } = props;
  const [content, setContent] = useState(template.content);

  return (
    <Stack gap="md" h="full" p="lg" overflow="hidden">
      <HStack justify="space-between" align="center">
        <Text textStyle="heading/S/semibold" truncate>
          {template.title}
        </Text>
        <HStack gap="sm">
          <Button size="sm" variant="outline" onClick={onDelete}>
            Delete
          </Button>
          <Button size="sm" onClick={() => onSave(content)}>
            Save
          </Button>
        </HStack>
      </HStack>
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        flex="1"
        resize="none"
        fontFamily="mono"
        fontSize="sm"
      />
    </Stack>
  );
};
