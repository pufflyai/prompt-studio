import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { StyleGuide } from "./style-guide";

type StoryFn = () => ReactNode;

const meta = {
  title: "Foundations/Style Guide",
  decorators: [
    (Story: StoryFn) => (
      <Box height="100vh" background="bg" overflowY="auto" overflowX="hidden">
        <Box padding="sm">
          <Story />
        </Box>
      </Box>
    ),
  ],
};

export default meta;

export const Overview = {
  render: () => <StyleGuide />,
};
