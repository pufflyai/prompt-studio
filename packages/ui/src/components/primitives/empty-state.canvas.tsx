import { Box, Button, Icon } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { FileText, Folder } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, type EmptyStateProps } from "@/components/primitives/empty-state";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

type StoryFn = () => ReactNode;
const meta: CanvasMeta<typeof EmptyState> = {
  title: "Design system/Components/Feedback/Empty state",
  component: EmptyState,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
  args: {
    title: "No documents yet.",
    description: "Upload files to start building extractions.",
  },
};
export default {
  title: "Design system/Components/Feedback/Empty state",
  fullscreen: true,
};
const Default = {
  id: "components-feedback-empty-state--default",
  render: (args: EmptyStateProps) => (
    <Box width="100%" maxWidth="420px">
      <EmptyState {...args} />
    </Box>
  ),
};
const WithIconAndAction = {
  id: "components-feedback-empty-state--with-icon-and-action",
  args: {
    title: "Nothing uploaded yet.",
    description: "Drop files into sample-raw or use the upload action.",
    icon: <Icon as={FileText} boxSize="28px" color="fg.muted" />,
  },
  render: (args: EmptyStateProps) => (
    <Box width="100%" maxWidth="420px">
      <EmptyState {...args}>
        <Button size="sm" variant="outline">
          Upload files
        </Button>
      </EmptyState>
    </Box>
  ),
};
const Compact = {
  id: "components-feedback-empty-state--compact",
  args: {
    title: "This folder is empty.",
    size: "sm",
    textAlign: "left",
    alignItems: "flex-start",
    icon: <Icon as={Folder} boxSize="20px" color="fg.muted" />,
  },
  render: (args: EmptyStateProps) => (
    <Box width="100%" maxWidth="420px">
      <EmptyState {...args} />
    </Box>
  ),
};

const Examples = createCanvasExampleNavigator(meta, { Default, WithIconAndAction, Compact });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
