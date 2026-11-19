import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { ExampleIcon } from "../../icon";
import { BackToProject } from "../back-to-project";
import type { MarmaladeTool } from "./marmalade.types";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

export const MarmaladeNav = () => {
  const title = useMarmalade((projection) => projection.state.document.title);
  return (
    <HStack h="full" px="sm" gap="sm">
      <BackToProject />
      <ExampleIcon name="Image" />
      <Text textStyle="label/M/medium">Marmalade</Text>
      <Text textStyle="label/S/regular" color="fg.muted" truncate>
        {title}
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
  const selectedTool = useMarmalade((projection) => projection.state.tool);
  return (
    <ScrollArea h="full">
      <Stack align="center" gap="xs" py="sm" role="toolbar" aria-label="Marmalade tools">
        {tools.map((tool) => (
          <Tooltip key={tool.id} content={tool.label}>
            <IconButton
              aria-label={tool.label}
              aria-pressed={selectedTool === tool.id}
              variant={selectedTool === tool.id ? "subtle" : "ghost"}
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
  const zoom = useMarmalade((projection) => Math.round(projection.state.zoom * 100));
  const width = useMarmalade((projection) => projection.state.document.width);
  const height = useMarmalade((projection) => projection.state.document.height);
  const layers = useMarmalade((projection) => projection.state.document.layers.length);
  const selected = useMarmalade((projection) => projection.state.selectedIds.length);
  return (
    <HStack h="full" px="sm" gap="md" aria-label="Marmalade status">
      <Text textStyle="label/XS">{zoom}%</Text>
      <Text textStyle="label/XS" color="fg.muted">
        {width} × {height} · RGB/8
      </Text>
      <Text textStyle="label/XS" color="fg.muted">
        {layers} layers · {selected} selected
      </Text>
    </HStack>
  );
};
