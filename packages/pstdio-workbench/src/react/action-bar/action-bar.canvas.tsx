import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { toActionBarSnapshot } from "../../extensions/contributions/action-bar-snapshot";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchActionBar } from "./action-bar";

export default {
  title: "Product/Workbench/Views/Action bar",
  description:
    "Drag tools and menu buttons by their surface to the insertion line. Dock the bar on any edge and use Alt plus the arrow keys along that edge to reorder a focused tool. Clicking still selects a tool or opens its menu.",
} satisfies CanvasMeta;

export const ToolsAndDocumentMenu = () => {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    workbench.pageLocations.setProject("preview");
    let selected = "move";
    workbench.views.registerView({ id: "tools", title: "Tools", body: { kind: "react", render: () => null } });
    workbench.commands.registerCommand(
      { id: "preview.editor.command.tool", label: "Select tool" },
      {
        execute: (args) => {
          selected = String((args as { tool: string }).tool);
          workbench.views.refreshView("tools");
        },
      },
    );
    return {
      workbench,
      lifetime: new AbortController().signal,
      load: async () =>
        toActionBarSnapshot(
          {
            items: [
              ...[
                { id: "move", label: "Move tool", icon: "Move" },
                { id: "text", label: "Text tool", icon: "Type" },
              ].map((tool) => ({
                ...tool,
                selected: selected === tool.id,
                action: {
                  kind: "command",
                  target: { command: { kind: "command", id: "tool" }, params: { tool: tool.id } },
                },
              })),
              {
                id: "document",
                label: "Document actions",
                icon: "Ellipsis",
                items: [
                  {
                    id: "undo",
                    label: "Undo",
                    disabled: true,
                    action: { kind: "command", target: { command: { kind: "command", id: "tool" } } },
                  },
                  {
                    id: "move",
                    label: "Choose Move tool",
                    action: {
                      kind: "command",
                      target: { command: { kind: "command", id: "tool" }, params: { tool: "move" } },
                    },
                  },
                ],
              },
            ],
          },
          "preview.editor",
          "preview",
        ),
    };
  });
  const edge = useWorkbenchStore(
    fixture.workbench.layout.store,
    () => fixture.workbench.shell.getArrangement().activity,
  );
  const horizontal = edge === "top" || edge === "bottom";
  return (
    <WorkbenchThemeProvider>
      <Stack h="full" gap="sm">
        <HStack>
          {(["left", "top", "right", "bottom"] as const).map((position) => (
            <Button
              key={position}
              size="xs"
              variant={edge === position ? "subtle" : "ghost"}
              onClick={() => fixture.workbench.shell.repositionPanel("activity", position)}
            >
              Dock {position}
            </Button>
          ))}
        </HStack>
        <Stack direction={horizontal ? "column" : "row"} align="stretch" flex="1" minH="80" gap="sm">
          <Box
            order={edge === "right" || edge === "bottom" ? 1 : 0}
            flexShrink="0"
            w={horizontal ? "full" : "14"}
            h={horizontal ? "14" : "full"}
            bg="bg.muted"
          >
            <WorkbenchActionBar
              ownerId="preview-tools"
              lifetime={fixture.lifetime}
              render={{
                workbench: fixture.workbench,
                panel: { id: "tools", title: "Tools", region: "activity", rendererId: "tools" },
                instance: { instanceId: "tools", panelId: "tools", closable: false },
                refresh() {},
              }}
              viewId="tools"
              title="Tools"
              projectId="preview"
              extensionId="preview.editor"
              load={fixture.load}
            />
          </Box>
          <Stack p="md" flex="1">
            <Text textStyle="label/M/medium">Document</Text>
            <Input aria-label="Document title" defaultValue="The Great Wave" />
          </Stack>
        </Stack>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
