import { Box, Text } from "ink";

import type { TemplateWithContent } from "../hooks/use-templates";

interface TemplateContentProps {
  template: TemplateWithContent;
  width: number;
  viewportHeight: number;
}

export function TemplateContent({ template, width, viewportHeight }: TemplateContentProps) {
  const separator = "─".repeat(width);
  const defaultLabel = template.is_default ? " │ default" : "";

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box>
        <Text bold color="cyan">
          {template.name}
        </Text>
        <Text dimColor> │ type: </Text>
        <Text>{template.template_type}</Text>
        <Text dimColor>{defaultLabel}</Text>
      </Box>

      <Text dimColor>{separator}</Text>

      <Box flexDirection="column" overflow="hidden" flexGrow={1}>
        <Text>{template.content}</Text>
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>Esc:back d:default</Text>
      </Box>
    </Box>
  );
}
