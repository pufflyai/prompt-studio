import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench, type WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "./workbench";

const projects = [
  { id: "project-a", name: "Project A" },
  { id: "project-b", name: "Project B" },
];
const ProjectName = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const project = projects.find((entry) => entry.id === projectId);
  return <Text p="md">{project?.name} content</Text>;
};
// The Side view keeps the same ID in every project, so only the project switch can reset its state.
const ProjectNotes = () => {
  const [count, setCount] = useState(0);
  return (
    <Box p="md">
      <Button size="sm" onClick={() => setCount((value) => value + 1)}>
        Notes edited {count} times
      </Button>
    </Box>
  );
};
const createProjectSwitchWorkbench = () => {
  const page = { kind: "page", extensionId: "example", id: "home" } as const;
  const workbench = createWorkbench({ initialSidePanelMode: "attached", startPage: page });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.views.registerView({
    id: "home",
    title: "Home",
    body: { kind: "react", render: () => <ProjectName workbench={workbench} /> },
  });
  workbench.views.registerView({
    id: "notes",
    title: "Notes",
    body: { kind: "react", render: () => <ProjectNotes /> },
  });
  workbench.views.registerView({
    id: "branch",
    title: "Branch",
    body: { kind: "react", render: () => <Text textStyle="xs">main</Text> },
  });
  workbench.statusBar.registerItem({ id: "branch.status-bar-item", viewId: "branch", slot: "leading" });
  workbench.modePlacements.registerPlacement({
    id: "notes",
    ref: { kind: "placement", extensionId: "example", id: "notes" },
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "notes" }, presence: "open" },
  });
  workbench.pages.registerPage({
    id: "home",
    ref: page,
    title: "Home",
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.switchProject(projects[0].id);
  return workbench;
};
const ProjectSwitchStory = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  return (
    <WorkbenchThemeProvider>
      <Flex direction="column" h="100dvh" minH="0" w="full">
        <HStack gap="sm" p="sm">
          {projects.map((project) => (
            <Button key={project.id} size="sm" onClick={() => workbench.pageLocations.switchProject(project.id)}>
              Open {project.name}
            </Button>
          ))}
        </HStack>
        <Box flex="1" minH="0" minW="0">
          <Workbench workbench={workbench} />
        </Box>
      </Flex>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Project switch",
  component: ProjectSwitchStory,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A project switch keeps the workbench shell mounted. Only views that belong to the project start fresh: open the Notes view, edit it, then open the other project.",
      },
    },
  },
} satisfies CanvasMeta<typeof ProjectSwitchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const KeepsShellMounted: Story = {
  id: "pstdio-workbench-guides-project-switch--keeps-shell-mounted",
  args: { workbench: createProjectSwitchWorkbench() },
};
