import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { MarmaladePropertyInput } from "./marmalade-property-input";

/** Synthetic layout exploration; the live inspector stores sizes through host preferences. */
const Properties = () => {
  const [accepted, setAccepted] = useState("The Great Wave");
  const [draft, setDraft] = useState(accepted);
  return (
    <Stack h="full" minH="0" gap="sm">
      <Text textStyle="label/S/medium">Properties</Text>
      <ScrollArea flex="1" minH="0">
        <Stack gap="sm">
          <MarmaladePropertyInput
            id="proposal-layer-name"
            label="Layer name"
            value={accepted}
            required
            onPreview={setDraft}
            onEdit={(value) => {
              setAccepted(value);
              setDraft(value);
            }}
            onCancel={() => setDraft(accepted)}
          />
          <Text textStyle="label/S/regular">{draft}</Text>
        </Stack>
      </ScrollArea>
    </Stack>
  );
};

const Layers = () => (
  <Stack h="full" minH="0" gap="sm">
    <Text textStyle="label/S/medium">Layers</Text>
    <ScrollArea flex="1" minH="0">
      <Stack gap="xs">
        {Array.from({ length: 24 }, (_, index) => (
          <Button key={index} size="xs" variant="ghost">
            Layer {index + 1}
          </Button>
        ))}
      </Stack>
    </ScrollArea>
  </Stack>
);

export const MarmaladeInspectorPreview = () => {
  const [size, setSize] = useState(240);
  const [open, setOpen] = useState(true);
  return (
    <Stack h="100vh" minH="0" gap="sm" p="md" bg="bg" color="fg">
      <HStack gap="xs" flexWrap="wrap">
        <Button size="xs" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close preview" : "Reopen preview"}
        </Button>
        <Text textStyle="label/XS" color="fg.muted">
          Preview retains group size only in memory.
        </Text>
      </HStack>
      {open ? (
        <Box flex="1" minH="0" minW="0">
          <ResizableSplitLayout
            h="full"
            resizableSide="bottom"
            defaultSizePx={size}
            minSizePx={96}
            contentMinSizePx={160}
            collapsible={false}
            resizeLabel="Resize layers group"
            onSizeChange={setSize}
            resizablePanel={<Layers />}
            contentPanel={<Properties />}
          />
        </Box>
      ) : null}
    </Stack>
  );
};
