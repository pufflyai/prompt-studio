import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { ScrollArea } from "./scroll-area";
import { StyleGuide } from "./style-guide";

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
