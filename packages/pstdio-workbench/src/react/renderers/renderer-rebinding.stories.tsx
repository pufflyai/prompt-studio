import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchControlsView } from "./controls/controls-view";
import { WorkbenchFileRendererView } from "./file/file-renderer-view";
import { WorkbenchKanbanView } from "./kanban/kanban-view";

const ControlsRebinding = () => {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const pending = Promise.withResolvers<void>();
    const renderers = getWorkbenchRenderers(workbench);
    renderers.registerControlsRenderer({
      id: "controls",
      title: "Resource controls",
      executeQuery: async (resource) => {
        if (resource?.id === "second") await pending.promise;
        return {
          params: [{ id: "name", name: "Resource name", type: "text", defaultValue: "" }],
          values: { name: resource?.id ?? "" },
        };
      },
      apply: () => {},
    });
    return { workbench, pending, contribution: renderers.getControlsRenderer("controls")! };
  });
  const [id, setId] = useState("first");
  return (
    <Stack gap="md">
      <Button onClick={() => setId("second")}>Select second resource</Button>
      <Button onClick={() => fixture.pending.resolve()}>Finish loading</Button>
      <Box height="sm">
        <WorkbenchControlsView
          workbench={fixture.workbench}
          contribution={fixture.contribution}
          placement={{
            instanceId: "controls",
            panelId: "controls",
            closable: false,
            resource: { type: "document", id },
          }}
        />
      </Box>
    </Stack>
  );
};

const FileContributionReplacement = () => {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    let registration: { dispose(): void } | undefined;
    const register = (content: string) => {
      registration?.dispose();
      registration = renderers.registerFileRenderer({
        id: "file",
        title: "File",
        load: () => ({ fileName: "readme.md", content }),
      });
      return renderers.getFileRenderer("file")!;
    };
    return { workbench, renderers, register, contribution: register("Old contribution") };
  });
  const [contribution, setContribution] = useState(fixture.contribution);
  return (
    <Stack gap="md">
      <Button onClick={() => setContribution(fixture.register("New contribution"))}>Replace contribution</Button>
      <Button onClick={() => fixture.renderers.refreshFileRenderer("file")}>Refresh file</Button>
      <Box height="sm">
        <WorkbenchFileRendererView workbench={fixture.workbench} contribution={contribution} />
      </Box>
    </Stack>
  );
};

const KanbanViewRefresh = () => {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const pending = Promise.withResolvers<void>();
    const renderers = getWorkbenchRenderers(workbench);
    let reads = 0;
    renderers.registerKanbanRenderer({
      id: "refresh-board",
      title: "Tasks",
      attributes: [{ id: "title", label: "Title", type: { kind: "string" }, sortable: true }],
      defaultSettings: { viewMode: "list", columnGrouping: "none", rowGrouping: "none", displayProperties: [] },
      executeQuery: async () => {
        reads += 1;
        if (reads === 1) return [{ id: "write", title: "Write docs", attributes: {} }];
        await pending.promise;
        return [{ id: "review", title: "Review docs", attributes: {} }];
      },
    });
    return { workbench, pending, contribution: renderers.getKanbanRenderer("refresh-board")! };
  });
  return (
    <Stack gap="md">
      <Button onClick={() => fixture.pending.resolve()}>Finish loading</Button>
      <Box height="md">
        <WorkbenchKanbanView
          workbench={fixture.workbench}
          contribution={fixture.contribution}
          placement={{ instanceId: "refresh-board", panelId: "refresh-board", closable: false }}
        />
      </Box>
    </Stack>
  );
};

const meta = {
  title: "Renderers/Rebinding",
  tags: ["!manifest"],
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const ControlsResourceChange: Story = {
  render: () => <ControlsRebinding />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("textbox")).toHaveValue("first");
    await userEvent.click(canvas.getByRole("button", { name: "Select second resource" }));
    await expect(await canvas.findByText("Loading…")).toBeVisible();
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await expect(await canvas.findByRole("textbox")).toHaveValue("second");
  },
};

export const FileContributionChange: Story = {
  render: () => <FileContributionReplacement />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Old contribution")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Replace contribution" }));
    await userEvent.click(canvas.getByRole("button", { name: "Refresh file" }));
    await expect(await canvas.findByText("New contribution")).toBeVisible();
  },
};

export const KanbanViewChange: Story = {
  render: () => <KanbanViewRefresh />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Write docs")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Sort" }));
    await userEvent.click(await within(document.body).findByRole("button", { name: "Add sort" }));
    await userEvent.keyboard("{Escape}");
    // A new sort runs the query again, but the old rows stay on screen until the new ones arrive.
    await expect(canvas.getByText("Write docs")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await expect(await canvas.findByText("Review docs")).toBeVisible();
  },
};
