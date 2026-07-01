import { Badge, Box, Button, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchWidgetRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { bridgeResource, bridgeWidgetId, rendererRows } from "./data";

interface RendererWidgetProps {
  input: WorkbenchWidgetRenderInput;
}

const RendererPanel = (props: { title: string; children: ReactNode }) => {
  const { children, title } = props;

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="sm" bg="bg.panel" overflow="hidden" minW="0">
      <HStack borderBottomWidth="1px" borderColor="border.subtle" gap="xs" minH="2.5rem" px="sm">
        <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
          {title}
        </Text>
      </HStack>
      <Box p="sm">{children}</Box>
    </Box>
  );
};

const RendererRow = (props: { icon: string; label: string; value: string }) => {
  const { icon, label, value } = props;

  return (
    <HStack gap="xs" minW="0">
      <WorkbenchIcon name={icon} size={14} color="fg.muted" />
      <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
        {label}
      </Text>
      <Code colorPalette="gray" truncate>
        {value}
      </Code>
    </HStack>
  );
};

export const ReactRendererWidget = (props: RendererWidgetProps) => {
  const { input } = props;
  const rendererIds = input.workbench.renderers.listRenderers().map((renderer) => renderer.id);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Grid templateColumns="repeat(auto-fit, minmax(10rem, 1fr))" gap="sm">
          <RendererPanel title="Renderer">
            <Stack gap="xs">
              <Badge alignSelf="flex-start" colorPalette="green" variant="subtle">
                React
              </Badge>
              <RendererRow icon="Component" label="Renderer id" value={input.widget.rendererId} />
              <RendererRow icon="PanelTop" label="Placement" value={input.placement.contributionId} />
            </Stack>
          </RendererPanel>
          <RendererPanel title="Workbench state">
            <Stack gap="xs">
              <RendererRow
                icon="PanelsTopLeft"
                label="Registered widgets"
                value={String(input.workbench.layout.listWidgets().length)}
              />
              <RendererRow icon="Component" label="Registered renderers" value={String(rendererIds.length)} />
            </Stack>
          </RendererPanel>
        </Grid>
        <RendererPanel title="Renderer inventory">
          <Stack gap="xs">
            {rendererRows.map((row) => (
              <HStack key={row.id} gap="xs" minW="0">
                <Badge colorPalette={row.kind === "React" ? "green" : "blue"} variant="subtle" minW="4.5rem">
                  {row.kind}
                </Badge>
                <Code colorPalette="gray" truncate>
                  {row.id}
                </Code>
                <Text textStyle="paragraph/S/regular" color="fg.muted" flex="1" minW="0" truncate>
                  {row.transport}
                </Text>
              </HStack>
            ))}
          </Stack>
        </RendererPanel>
        <HStack gap="sm">
          <Button
            size="sm"
            variant="subtle"
            onClick={() => input.workbench.layout.openWidget(bridgeWidgetId, { resource: bridgeResource })}
          >
            <WorkbenchIcon name="Cable" />
            Bridge renderer
          </Button>
        </HStack>
      </Stack>
    </ScrollArea>
  );
};
