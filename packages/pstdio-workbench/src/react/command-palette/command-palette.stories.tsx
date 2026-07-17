import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createWorkbenchCore, type WorkbenchCore } from "../../core";
import { Workbench } from "../workbench/workbench";

const registerPaletteFixture = (workbench: WorkbenchCore) => {
  workbench.layout.registerWidget({ id: "story.primary", title: "Ticket", area: "main", rendererId: "story.primary" });
  workbench.renderers.registerRenderer({
    id: "story.primary",
    render: () => (
      <Box p="lg">
        <Text textStyle="heading/M/semibold">Command palette fixture</Text>
      </Box>
    ),
  });
  workbench.layout.registerWidget({
    id: "story.output",
    title: "Output",
    area: "secondary",
    rendererId: "story.output",
    openable: true,
    resourceKinds: ["ticket"],
  });
  workbench.layout.registerWidget({
    id: "story.sessions",
    title: "Sessions",
    area: "side",
    rendererId: "story.sessions",
    openable: true,
  });
  workbench.resources.registerKind({ kind: "project", label: "Projects", icon: "folder-root" });
  workbench.resources.registerKind({ kind: "ticket", label: "Tickets", icon: "component" });
  workbench.resources.registerProvider({
    id: "story.projects",
    kind: "project",
    list: () => [
      { resource: { kind: "project", uri: "story://project/one", label: "Prompt Studio" } },
      { resource: { kind: "project", uri: "story://project/two", label: "Design system" } },
    ],
  });
  workbench.resources.registerProvider({
    id: "story.tickets",
    kind: "ticket",
    list: () => [{ resource: { kind: "ticket", uri: "story://ticket/PS-180", label: "PS-180 Global overlays" } }],
  });
  workbench.layout.openWidget("story.primary", {
    resource: { kind: "ticket", uri: "story://ticket/PS-180", label: "PS-180 Global overlays" },
  });
};

const groupedPaletteWorkbench = createWorkbenchCore();
registerPaletteFixture(groupedPaletteWorkbench);
groupedPaletteWorkbench.commandPalette.open();

const projectResourceModalWorkbench = createWorkbenchCore();
registerPaletteFixture(projectResourceModalWorkbench);
projectResourceModalWorkbench.commandPalette.open({ view: "resource", resourceKind: "project" });

const StoryFrame = (props: { workbench: WorkbenchCore }) => (
  <Box h="100dvh" w="full">
    <Workbench workbench={props.workbench} />
  </Box>
);

const meta = {
  title: "pstdio-workbench/CommandPalette",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PanelAndResourceGroups: Story = {
  render: () => <StoryFrame workbench={groupedPaletteWorkbench} />,
};

export const ProjectResourceModal: Story = {
  render: () => <StoryFrame workbench={projectResourceModalWorkbench} />,
};
