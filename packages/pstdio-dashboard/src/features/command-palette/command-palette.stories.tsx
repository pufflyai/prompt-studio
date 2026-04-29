import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import type { CommandPaletteView } from "./command-palette";
import { CommandPalette } from "./command-palette";

const tickets = [
  { shorthand: "PS-74", title: "Add command palette" },
  { shorthand: "PS-101", title: "Theme dashboard surfaces" },
  { shorthand: "PS-134", title: "Improve API error chains" },
];

const CommandPaletteStoryContent = (props: { initialView?: CommandPaletteView }) => {
  const { initialView } = props;

  return (
    <Box bg="bg" minH="32rem" p="lg">
      <CommandPalette
        open
        initialView={initialView}
        projectId="project-1"
        tickets={tickets}
        requestCreateTicket={() => undefined}
        createSession={() => undefined}
        openShortcutHelp={() => undefined}
        onClose={() => undefined}
      />
    </Box>
  );
};

const createStoryRouter = (initialView?: CommandPaletteView) => {
  const rootRoute = createRootRoute({
    component: () => <CommandPaletteStoryContent initialView={initialView} />,
  });

  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
};

const CommandPaletteStory = (props: { initialView?: CommandPaletteView }) => {
  const { initialView } = props;
  const [router] = useState(() => createStoryRouter(initialView));

  return <RouterProvider router={router} />;
};

const meta: Meta = {
  title: "Project/CommandPalette",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <CommandPaletteStory />,
};

export const ThemeMenu: Story = {
  render: () => <CommandPaletteStory initialView="theme" />,
};
