import { Box } from "@chakra-ui/react";
import { Figma, Github, Slack } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { IntegrationCard } from "@/components/primitives/integration-card";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

type StoryFn = () => ReactNode;
type IntegrationCardArgs = ComponentProps<typeof IntegrationCard>;
const meta = {
  title: "Design system/Components/Data display/Integration card",
  component: IntegrationCard,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg" maxWidth="640px">
        <Story />
      </Box>
    ),
  ],
  args: {
    icon: <Github />,
    name: "GitHub",
    version: "1.2.0",
    description: "Link repositories and track code changes.",
    id: "github",
    active: false,
  },
};
export default {
  title: "Design system/Components/Data display/Integration card",
  fullscreen: true,
};
const Default = {
  id: "components-data-display-integration-card--default",
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};
const Active = {
  id: "components-data-display-integration-card--active",
  args: {
    icon: <Slack />,
    name: "Slack",
    description: "Get notifications and updates in Slack channels.",
    id: "slack",
    active: true,
  },
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};
const Paid = {
  id: "components-data-display-integration-card--paid",
  args: {
    icon: <Figma />,
    name: "Figma",
    description: "Preview designs and sync assets from Figma.",
    id: "figma",
    category: "Paid",
  },
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};

const Examples = createCanvasExampleNavigator(meta, { Default, Active, Paid });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
