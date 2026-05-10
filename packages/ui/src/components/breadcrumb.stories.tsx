import { Box, Icon } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Breadcrumb } from "./breadcrumb";

type StoryFn = () => ReactNode;

const items = [
  { title: "Dashboard", url: "/" },
  { title: "Invoices", url: "/invoices" },
  { title: "Northwind Traders Q4 2024" },
];

const meta = {
  title: "Components/Breadcrumb",
  component: Breadcrumb,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
  args: {
    items,
    separator: "/",
    separatorGap: "xs",
  },
};

export default meta;

export const Default = {};

export const IconSeparator = {
  args: {
    separator: <Icon as={ChevronRight} boxSize="12px" color="fg.muted" />,
  },
};

export const Narrow = {
  args: {
    items: [
      { title: "Projects", url: "/" },
      { title: "PS-246 Update chat panel styles and responsive properties panel" },
    ],
  },
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg" width="220px">
        <Story />
      </Box>
    ),
  ],
};
