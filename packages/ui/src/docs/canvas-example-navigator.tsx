import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { type CanvasFrame, type CanvasMeta, type CanvasRender, composePreview } from "@pstdio/canvas";
import { useState } from "react";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";

const exampleName = (id: string) =>
  id
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word : word.toLowerCase()))
    .join(" ");

// Colocated examples keep their fixtures and decorators; only the selected example mounts.
export const createCanvasExampleNavigator = (meta: CanvasMeta, frames: Record<string, CanvasFrame | CanvasRender>) => {
  const examples = Object.entries(frames).map(([id, frame]) => ({
    id,
    label: (typeof frame === "object" && frame.name) || exampleName(id),
    ...composePreview(frame, meta),
  }));
  return function CanvasExampleNavigator() {
    const [selected, setSelected] = useState(examples[0].id);
    const active = examples.find((example) => example.id === selected)!;
    const { Component } = active;
    return (
      <Stack h="full" minH="0" gap="sm" p="sm">
        <Box>
          <SearchableMenu
            trigger={
              <Button variant="outline" aria-label="Choose example">
                {active.label}
              </Button>
            }
            items={examples.map((example) => ({
              id: example.id,
              label: example.label,
              isSelected: example.id === selected,
              onSelect: () => setSelected(example.id),
            }))}
            searchPlaceholder="Find example"
            emptyState="No examples found"
          />
        </Box>
        {active.description && <Text textStyle="paragraph/S/regular">{active.description}</Text>}
        <ScrollArea flex="1" minH="0">
          <Component key={active.id} />
        </ScrollArea>
      </Stack>
    );
  };
};
