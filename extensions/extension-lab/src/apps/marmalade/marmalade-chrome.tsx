import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { ExampleIcon } from "../../icon";
import { BackToProject } from "../back-to-project";
import type { MarmaladeTool } from "./marmalade.types";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

export const MarmaladeNav = () => {
  const { state } = useMarmalade();
  return (
    <HStack h="full" px="sm" gap="sm">
      <BackToProject />
      <ExampleIcon name="Image" />
      <Text textStyle="label/M/medium">Marmalade</Text>
      <Text textStyle="label/S/regular" color="fg.muted" truncate>
        {state.document.title}
      </Text>
      <Box flex="1" />
      <Button size="xs" variant="ghost" onClick={() => void marmaladeStore.dispatch({ type: "empty" })}>
        New
      </Button>
      <Button size="xs" variant="ghost" onClick={() => void marmaladeStore.dispatch({ type: "reset" })}>
        Restore sample
      </Button>
    </HStack>
  );
};
const tools: { id: MarmaladeTool; label: string; icon: string }[] = [
  { id: "move", label: "Move tool", icon: "Move" },
  { id: "text", label: "Text tool", icon: "Type" },
  { id: "rectangle", label: "Rectangle tool", icon: "Square" },
  { id: "ellipse", label: "Ellipse tool", icon: "Circle" },
  { id: "brush", label: "Brush tool", icon: "Paintbrush" },
  { id: "hand", label: "Hand tool", icon: "Hand" },
  { id: "zoom", label: "Zoom tool", icon: "ZoomIn" },
];
export const MarmaladeRail = () => {
  const { state } = useMarmalade();
  return (
    <ScrollArea h="full">
      <Stack align="center" gap="xs" py="sm" role="toolbar" aria-label="Marmalade tools">
        {tools.map((tool) => (
          <Tooltip key={tool.id} content={tool.label}>
            <IconButton
              aria-label={tool.label}
              aria-pressed={state.tool === tool.id}
              variant={state.tool === tool.id ? "subtle" : "ghost"}
              size="xs"
              onClick={() => void marmaladeStore.dispatch({ type: "tool", tool: tool.id })}
            >
              <ExampleIcon name={tool.icon} />
            </IconButton>
          </Tooltip>
        ))}
      </Stack>
    </ScrollArea>
  );
};
export const MarmaladeStatus = () => {
  const { state } = useMarmalade();
  return (
    <HStack h="full" px="sm" gap="md" aria-label="Marmalade status">
      <Text textStyle="label/XS">{Math.round(state.zoom * 100)}%</Text>
      <Text textStyle="label/XS" color="fg.muted">
        {state.document.width} × {state.document.height} · RGB/8
      </Text>
      <Text textStyle="label/XS" color="fg.muted">
        {state.document.layers.length} layers · {state.selectedIds.length} selected
      </Text>
    </HStack>
  );
};
