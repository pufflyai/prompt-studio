import { Box, Button, HStack, IconButton, Portal, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, ScopedMenu, ScrollArea, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import { MarmaladePropertyInput } from "../../apps/marmalade/marmalade-property-input";
import { EditingError } from "../../editing-error";
import { ExampleIcon } from "../../icon";

/** Synthetic only: no bridge, files, real records, keyboard registrations or downloads. */
export const NativeActions = () => {
  const [tool, setTool] = useState("Move");
  const [outcome, setOutcome] = useState("success");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const deliver = () => {
    setError(outcome === "failure" ? "The export could not be delivered. Try again." : "");
    setMessage(outcome === "cancel" ? "Export cancelled." : "");
    if (outcome === "success") setMessage("Export delivered: great-wave.svg");
  };
  return (
    <Stack gap="md" p="md" bg="bg" color="fg">
      <HStack gap="xs" flexWrap="wrap" aria-label="Preview delivery controls">
        {["success", "cancel", "failure"].map((value) => (
          <Button
            key={value}
            size="xs"
            variant={outcome === value ? "solid" : "outline"}
            onClick={() => setOutcome(value)}
          >
            {value}
          </Button>
        ))}
      </HStack>
      <HStack align="stretch" gap="md">
        <Stack gap="xs" role="toolbar" aria-label="Marmalade actions">
          {[
            { label: "Move", icon: "Move", key: "V" },
            { label: "Text", icon: "Type", key: "T" },
            { label: "Hand", icon: "Hand", key: "H" },
            { label: "Zoom", icon: "ZoomIn", key: "Z" },
          ].map((item) => (
            <Tooltip key={item.label} content={`${item.label} (${item.key}, Current view)`}>
              <IconButton
                size="xs"
                aria-label={`${item.label} tool`}
                aria-pressed={tool === item.label}
                variant={tool === item.label ? "subtle" : "ghost"}
                onClick={() => setTool(item.label)}
              >
                <ExampleIcon name={item.icon} />
              </IconButton>
            </Tooltip>
          ))}
          <ScopedMenu.Root>
            <ScopedMenu.Trigger asChild>
              <IconButton size="xs" variant="ghost" aria-label="Document actions">
                <ExampleIcon name="Ellipsis" />
              </IconButton>
            </ScopedMenu.Trigger>
            <Portal>
              <ScopedMenu.Positioner>
                <ScopedMenu.Content>
                  <ScopedMenu.Item value="export" onClick={deliver}>
                    Export SVG
                  </ScopedMenu.Item>
                </ScopedMenu.Content>
              </ScopedMenu.Positioner>
            </Portal>
          </ScopedMenu.Root>
        </Stack>
        <Stack flex="1" minW="0" gap="sm" bg="bg.panel" p="md">
          <Text textStyle="label/M/medium">The Great Wave</Text>
          <Text textStyle="label/S/regular">{tool} tool</Text>
          {message ? (
            <Text role="status" textStyle="label/S/regular">
              {message}
            </Text>
          ) : null}
          {error ? <EditingError error={error} retry={deliver} /> : null}
        </Stack>
      </HStack>
    </Stack>
  );
};

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

export const InspectorLayout = () => {
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
