import { Box } from "@chakra-ui/react";
import { Figma, Github, Slack } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { IntegrationCard } from "@/components/primitives/integration-card";

type StoryFn = () => ReactNode;
type IntegrationCardArgs = ComponentProps<typeof IntegrationCard>;

const meta = {
  title: "Components/Data Display/Integration Card",
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

export default meta;

export const Default = {
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};

export const Active = {
  args: {
    icon: <Slack />,
    name: "Slack",
    description: "Get notifications and updates in Slack channels.",
    id: "slack",
    active: true,
  },
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};

export const Paid = {
  args: {
    icon: <Figma />,
    name: "Figma",
    description: "Preview designs and sync assets from Figma.",
    id: "figma",
    category: "Paid",
  },
  render: (args: IntegrationCardArgs) => <IntegrationCard {...args} />,
};
