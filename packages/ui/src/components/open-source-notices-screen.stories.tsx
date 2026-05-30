import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { OpenSourceNoticesScreen } from "./open-source-notices-screen";

const meta = {
  title: "Components/Data Display/Open Source Notices Screen",
  component: OpenSourceNoticesScreen,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof OpenSourceNoticesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const notices = [
  {
    name: "react",
    version: "19.0.0",
    license: "MIT",
    copyright: "Copyright (c) Meta Platforms, Inc.",
    homepageUrl: "https://react.dev",
    sourceUrl: "https://github.com/facebook/react",
  },
  {
    name: "chakra-ui",
    version: "3.28.0",
    license: "MIT",
    copyright: "Copyright (c) Chakra UI Team",
    homepageUrl: "https://chakra-ui.com",
    sourceUrl: "https://github.com/chakra-ui/chakra-ui",
    attribution:
      "Portions of this software include work distributed under the MIT License. See project repository for full text.",
  },
  {
    name: "lucide-react",
    version: "0.469.0",
    license: "ISC",
    sourceUrl: "https://github.com/lucide-icons/lucide",
  },
];

export const Populated: Story = {
  render: (props) => (
    <Box minHeight="100vh" bg="bg">
      <OpenSourceNoticesScreen {...props} />
    </Box>
  ),
  args: {
    notices,
    productName: "Prompt Studio Desktop",
    productVersion: "1.8.3",
    generatedAt: "2026-02-27",
  },
};

export const Empty: Story = {
  render: (props) => (
    <Box minHeight="100vh" bg="bg">
      <OpenSourceNoticesScreen {...props} />
    </Box>
  ),
  args: {
    notices: [],
    productName: "Prompt Studio Desktop",
    productVersion: "1.8.3",
    generatedAt: "2026-02-27",
  },
};
