import { Badge, Box, Button, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef } from "react";
import type { WorkbenchWidgetRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { createBridgeDocument, isBridgeActionMessage } from "./bridge-document";
import { bridgeResource, bridgeWidgetId, openReactCommandId, rendererRows } from "./data";

interface RendererWidgetProps {
  input: WorkbenchWidgetRenderInput;
}

const RendererPanel = (props: { title: string; children: ReactNode }) => {
  const { children, title } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" bg="bg.panel" overflow="hidden" minW="0">
      <HStack borderBottomWidth="1px" borderColor="border.muted" gap="xs" minH="2.5rem" px="sm">
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

export const BridgeRendererWidget = (props: RendererWidgetProps) => {
  const { input } = props;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const payload = {
    rendererId: input.widget.rendererId,
    widgetId: input.widget.id,
    placementId: input.placement.widgetId,
    title: input.placement.title ?? input.widget.title,
    resource: input.placement.resource?.uri,
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!isBridgeActionMessage(event.data)) return;

      if (event.data.action === "notify") {
        input.workbench.notifications.show({
          level: "info",
          title: "Bridge renderer",
          message: "The iframe bridge posted a host notification.",
        });
        input.refresh();
        return;
      }

      void input.workbench.commands.executeCommand(openReactCommandId).then(input.refresh);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [input]);

  return (
    <Box h="full" minH="0" bg="bg.subtle">
      <iframe
        ref={frameRef}
        title="Bridge renderer"
        sandbox="allow-scripts"
        srcDoc={createBridgeDocument(payload)}
        style={{
          border: 0,
          display: "block",
          height: "100%",
          minHeight: 0,
          width: "100%",
        }}
      />
    </Box>
  );
};
