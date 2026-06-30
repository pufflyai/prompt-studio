import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { StyleGuide } from "@/components/internal/style-guide";
import { ScrollArea } from "@/components/primitives/scroll-area";

type StoryFn = () => ReactNode;

const meta = {
  title: "Foundations/Style Guide",
  decorators: [
    (Story: StoryFn) => (
      <ScrollArea height="100vh" background="bg" contentProps={{ padding: "sm" }}>
        <Box>
          <Story />
        </Box>
      </ScrollArea>
    ),
  ],
};

export default meta;

export const Overview = {
  render: () => <StyleGuide />,
};
