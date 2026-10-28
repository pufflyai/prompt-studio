import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchKanbanView } from "./kanban-view";

const DeferredMove = (props: { viewMode?: "board" | "list" }) => {
  const { viewMode = "board" } = props;
  const [pending, setPending] = useState<Array<(success: boolean) => void>>([]);
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    let rows = [{ id: "task", title: "Review ticket filters", attributes: { status: "backlog" } }];
    renderers.registerKanbanRenderer({
      id: "deferred-move",
      title: "Tasks",
      attributes: [
        {
          id: "status",
          label: "Status",
          groupable: true,
          displayable: true,
          editable: true,
          type: {
            kind: "enum",
            options: [
              { value: "backlog", label: "Backlog" },
              { value: "ready", label: "Ready" },
              { value: "done", label: "Done" },
            ],
          },
        },
      ],
      defaultSettings: { viewMode, columnGrouping: "status", rowGrouping: "none", displayProperties: ["status"] },
      executeQuery: () => rows,
      getBoardColumnConfig: () => ({ canCreate: false }),
      onAttributeChange: (rowId, attributeId, value) =>
        new Promise<void>((resolve, reject) => {
          const finish = (success: boolean) => {
            if (success) {
              rows = rows.map((row) =>
                row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
              );
              resolve();
            } else reject(new Error("Status save failed"));
          };
          setPending((current) => [...current, finish]);
        }),
    });
    return { workbench, contribution: renderers.getKanbanRenderer("deferred-move")! };
  });
  const finish = (success: boolean) => {
    pending[0]?.(success);
    setPending((current) => current.slice(1));
  };
  return (
    <WorkbenchThemeProvider>
      <Stack height="xl">
        <HStack>
          <Button onClick={() => finish(true)}>Finish save</Button>
          <Button onClick={() => finish(false)}>Reject save</Button>
          <Text>{pending.length} saves pending</Text>
        </HStack>
        <Box flex="1" minH="0">
          <WorkbenchKanbanView
            workbench={fixture.workbench}
            contribution={fixture.contribution}
            placement={{ instanceId: "deferred-move", panelId: "deferred-move", closable: false }}
          />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
const meta: CanvasMeta = { title: "Renderers/Kanban/Move Preview", tags: ["!manifest"] };
export default meta;
export const MoveBeforeSave: CanvasVariant = {
  id: "renderers-kanban-move-preview--move-before-save",
  render: () => <DeferredMove />,
};
export const RestoreAfterFailure: CanvasVariant = {
  id: "renderers-kanban-move-preview--restore-after-failure",
  render: () => <DeferredMove />,
};
export const PropertyBeforeSave: CanvasVariant = {
  id: "renderers-kanban-move-preview--property-before-save",
  render: () => <DeferredMove />,
};
export const PropertyFailure: CanvasVariant = {
  id: "renderers-kanban-move-preview--property-failure",
  render: () => <DeferredMove />,
};
export const ListPropertyBeforeSave: CanvasVariant = {
  id: "renderers-kanban-move-preview--list-property-before-save",
  render: () => <DeferredMove viewMode="list" />,
};
export const LaterPropertySurvivesFailure: CanvasVariant = {
  id: "renderers-kanban-move-preview--later-property-survives-failure",
  render: () => <DeferredMove />,
};
